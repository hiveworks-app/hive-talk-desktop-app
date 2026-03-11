'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useChatRoomActions } from '@/features/chat-room/useChatRoomActions';
import { useChatRoomController } from '@/features/chat-room/useChatRoomController';
import { useChatRoomSearch } from '@/features/chat-room/useChatRoomSearch';
import { cn } from '@/shared/lib/cn';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { ChatInput } from '@/widgets/chat-room/ChatInput';
import { MessageBubble } from '@/widgets/chat-room/MessageBubble';

const SidePanel = dynamic(
  () => import('@/widgets/side-panel/SidePanel').then(m => m.SidePanel),
  { ssr: false },
);

interface ChatRoomViewProps {
  routePrefix: '/chat' | '/external-chat';
  showNextMessage?: boolean;
}

export function ChatRoomView({ routePrefix, showNextMessage = false }: ChatRoomViewProps) {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId as string;

  const storeRoomId = useChatRoomInfo(s => s.roomId);
  useEffect(() => {
    if (!storeRoomId && roomId) {
      router.replace(routePrefix);
    }
  }, [storeRoomId, roomId]);

  useChatRoomController();

  const { sendTextMessage, sendMediaMessage, sendDocumentMessage, loadMoreBeforeMessage } =
    useChatRoomActions();
  const messages = useChatRoomRuntimeStore(s => s.messages);
  const { hasMoreBefore, isBeforeLoading } = useChatRoomRuntimeStore(s => s.loading);
  const scrollToBottomTrigger = useChatRoomRuntimeStore(s => s.scrollToBottomTrigger);
  const { roomName, totalUserCount, channelType, lastMessage, initialNotReadCount } = useChatRoomInfo();
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // MediaViewer state
  const [viewerItems, setViewerItems] = useState<MediaViewerItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const openMediaViewer = useCallback(
    (items: MediaViewerItem[], startIndex: number) => {
      setViewerItems(items);
      setViewerIndex(startIndex);
      setViewerVisible(true);
    },
    [],
  );

  const closeMediaViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(initialNotReadCount === 0);
  const prevScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const canDismissSeparatorRef = useRef(false);

  // 구분선 표시: roomId 기반으로 추적 (setState in useEffect 회피)
  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(null);
  const UNREAD_SEPARATOR_THRESHOLD = 20;
  const showUnreadSeparator = initialNotReadCount >= UNREAD_SEPARATOR_THRESHOLD && dismissedRoomId !== storeRoomId;

  // 방 변경 시 스크롤 상태 리셋
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = initialNotReadCount === 0;
    canDismissSeparatorRef.current = false;
  }, [storeRoomId]);

  // 메시지 로드 후 스크롤 위치 결정
  useEffect(() => {
    if (messages.length === 0) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;

      if (initialNotReadCount === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        isNearBottomRef.current = true;
      } else {
        const separator = document.getElementById('unread-separator');
        if (separator) {
          separator.scrollIntoView({ behavior: 'auto', block: 'center' });
          // scrollIntoView 직후 scroll 이벤트가 발생하면 구분선이 즉시 사라지는 것 방지
          setTimeout(() => { canDismissSeparatorRef.current = true; }, 500);
        } else {
          // 구분선 미표시 (임계값 미만) → 하단으로 이동
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          isNearBottomRef.current = true;
        }
      }
      return;
    }

    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    if (scrollToBottomTrigger > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToBottomTrigger]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isNearBottomRef.current = nearBottom;

    if (nearBottom && canDismissSeparatorRef.current) {
      setDismissedRoomId(storeRoomId);
    }

    if (scrollTop < 50 && hasMoreBefore && !isBeforeLoading) {
      prevScrollHeightRef.current = scrollHeight;
      loadMoreBeforeMessage('before');
    }
  }, [hasMoreBefore, isBeforeLoading, loadMoreBeforeMessage, storeRoomId]);

  const search = useChatRoomSearch({
    containerRef: messagesContainerRef,
    loadMoreBeforeMessage: () => loadMoreBeforeMessage('before'),
  });

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || prevScrollHeightRef.current === 0) return;

    const newScrollHeight = container.scrollHeight;
    const diff = newScrollHeight - prevScrollHeightRef.current;
    if (diff > 0) {
      container.scrollTop += diff;
    }
    prevScrollHeightRef.current = 0;
  }, [messages.length]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        if (search.isSearchMode) {
          search.exitSearchMode();
        } else {
          search.enterSearchMode();
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (viewerVisible) return;
        if (search.isSearchMode) {
          search.exitSearchMode();
        } else if (isSidePanelOpen) {
          setIsSidePanelOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [search, isSidePanelOpen, viewerVisible]);

  if (!storeRoomId) return null;

  const lastMessageId = lastMessage?.message?.id || messages[messages.length - 1]?.id || '';

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* 헤더 */}
        <header className="electron-drag border-b border-divider">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="electron-no-drag flex items-center gap-2">
              <button
                onClick={() => router.push(routePrefix)}
                className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-gray-100 md:hidden"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h2 className="text-heading-sm font-bold text-text-primary">{roomName || '채팅방'}</h2>
              {totalUserCount > 0 && (
                <span className="text-sub-sm text-text-tertiary">{totalUserCount}</span>
              )}
            </div>
            <div className="electron-no-drag flex items-center gap-1">
              <button
                onClick={() => {
                  if (search.isSearchMode) {
                    search.exitSearchMode();
                  } else {
                    search.enterSearchMode();
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                  search.isSearchMode ? 'bg-gray-200 text-text-primary' : 'text-text-tertiary hover:bg-gray-100',
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
              <button
                onClick={() => setIsSidePanelOpen(prev => !prev)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                  isSidePanelOpen ? 'bg-gray-200 text-text-primary' : 'text-text-tertiary hover:bg-gray-100',
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </button>
            </div>
          </div>
          {/* 검색바 */}
          {search.isSearchMode && (
            <div className="flex items-center gap-2 border-t border-divider px-4 py-2">
              <input
                ref={searchInputRef}
                type="text"
                value={search.searchKeyword}
                onChange={e => search.handleSearchKeywordChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') search.handleSearchSubmit(search.searchKeyword);
                  if (e.key === 'Escape') search.exitSearchMode();
                }}
                placeholder="메시지 검색..."
                className="flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
              />
              {search.totalCount > 0 && (
                <span className="shrink-0 text-sub-sm text-text-secondary">
                  {search.displayIndex}/{search.totalCount}
                </span>
              )}
              {search.isSearching && (
                <span className="shrink-0 text-sub-sm text-text-tertiary">검색 중...</span>
              )}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={search.goToPrevious}
                  disabled={!search.canGoPrev}
                  className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-gray-100 disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  onClick={search.goToNext}
                  disabled={!search.canGoNext}
                  className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-gray-100 disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
              <button
                onClick={search.exitSearchMode}
                className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* 메시지 리스트 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="scrollbar-thin flex-1 overflow-y-auto px-4 py-2"
        >
          {isBeforeLoading && (
            <div className="flex justify-center py-2">
              <span className="text-sub-sm text-text-tertiary">불러오는 중...</span>
            </div>
          )}
          {(() => {
            const unreadBoundaryIndex = showUnreadSeparator && initialNotReadCount > 0
              ? Math.max(0, messages.length - initialNotReadCount)
              : -1;

            return messages.map((msg, idx) => (
              <div key={msg.id}>
                {idx === unreadBoundaryIndex && (
                  <div
                    id="unread-separator"
                    className="my-3 flex items-center gap-3"
                  >
                    <div className="flex-1 border-t border-state-primary/40" />
                    <span className="shrink-0 text-[11px] font-medium text-state-primary/70">
                      여기까지 읽었습니다
                    </span>
                    <div className="flex-1 border-t border-state-primary/40" />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  prevMessage={messages[idx - 1]}
                  nextMessage={showNextMessage ? messages[idx + 1] : undefined}
                  index={idx}
                  isFocused={search.focusedMessageId === msg.id}
                  onOpenMedia={openMediaViewer}
                />
              </div>
            ));
          })()}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 */}
        <ChatInput
          onSend={sendTextMessage}
          onSendMedia={sendMediaMessage}
          onSendDocument={sendDocumentMessage}
        />
      </main>

      {/* 사이드 패널 */}
      <SidePanel
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        roomId={roomId}
        channelType={channelType}
        lastMessageId={lastMessageId}
      />

      {/* 미디어 뷰어 */}
      <MediaViewer
        visible={viewerVisible}
        items={viewerItems}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={closeMediaViewer}
      />
    </div>
  );
}

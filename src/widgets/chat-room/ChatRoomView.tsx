'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useCreateNoticeMutation } from '@/features/chat-room/notice/queries';
import { useChatRoomActions } from '@/features/chat-room/useChatRoomActions';
import { useChatRoomController } from '@/features/chat-room/useChatRoomController';
import { useChatRoomSearch } from '@/features/chat-room/useChatRoomSearch';
import { cn } from '@/shared/lib/cn';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store/uiStore';
import { ChatInput } from './ChatInput';
import { ChatRoomHeader } from './ChatRoomHeader';
import { FileConfirmDialog } from './FileConfirmDialog';
import { MessageBubble } from './MessageBubble';
import { MessageSkeleton } from './MessageSkeleton';
import { NoticeBanner } from './NoticeBanner';
import { SelectedTagOverlay } from './SelectedTagOverlay';
import { TagSelectPanel } from './TagSelectPanel';
import { useFileDragDrop } from './useFileDragDrop';
import { useMediaViewer } from './useMediaViewer';
import { useScrollManagement } from './useScrollManagement';
import { useTagActions } from './useTagActions';

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
  const router = useAppRouter();
  const urlRoomId = params?.roomId as string | undefined;

  const storeRoomId = useChatRoomInfo(s => s.roomId);
  const invitedUserIds = useChatRoomInfo(s => s.invitedUserIds);
  const isNewRoom = !storeRoomId && invitedUserIds.length > 0;

  useEffect(() => {
    if (!storeRoomId && !isNewRoom && urlRoomId) router.replace(routePrefix);
  }, [storeRoomId, isNewRoom, urlRoomId]);

  useChatRoomController();

  const { sendTextMessage, sendMediaMessage, sendDocumentMessage, loadMoreBeforeMessage, deleteMessage, addTagToMessage, removeTagFromMessage, retryTextMessage, removeFailedMessage } =
    useChatRoomActions();
  const messages = useChatRoomRuntimeStore(s => s.messages);
  const runtimeRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const { hasMoreBefore, isBeforeLoading } = useChatRoomRuntimeStore(s => s.loading);
  const scrollToBottomTrigger = useChatRoomRuntimeStore(s => s.scrollToBottomTrigger);
  const isRoomTransitioning = !isNewRoom && storeRoomId !== runtimeRoomId;
  const { roomName, totalUserCount, channelType, lastMessage, initialNotReadCount } = useChatRoomInfo();
  const effectiveRoomId = isNewRoom ? '' : (storeRoomId || runtimeRoomId || '');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { mutate: createNotice } = useCreateNoticeMutation(effectiveRoomId, channelType);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const handleSetNotice = useCallback((text: string) => {
    if (!window.confirm('이 메시지를 공지로 등록하시겠습니까?')) return;
    createNotice({ title: text, content: text }, {
      onSuccess: () => showSnackbar({ message: '공지가 등록되었습니다.' }),
      onError: () => showSnackbar({ message: '공지 등록에 실패했습니다.', state: 'error' }),
    });
  }, [createNotice, showSnackbar]);

  const { isTagOpen, handleOpenAddTag, handleOpenUpdateTag, handleTagConfirm, handleSendWithTags } =
    useTagActions({ roomId: effectiveRoomId, sendTextMessage, addTagToMessage, removeTagFromMessage });
  const { pendingItems, clearPendingItems, handleFileConfirm, handleFilesSelected, dragHandlers } =
    useFileDragDrop({ onMediaSend: sendMediaMessage, onDocSend: sendDocumentMessage });
  const { viewerIndex, setViewerIndex, viewerVisible, allMediaItems, openMediaViewer, closeMediaViewer } =
    useMediaViewer(messages);
  const { messagesEndRef, messagesContainerRef, messagesContentRef, handleScroll, showUnreadSeparator } =
    useScrollManagement({
      messagesLength: messages.length, isRoomTransitioning, storeRoomId,
      initialNotReadCount, scrollToBottomTrigger, hasMoreBefore, isBeforeLoading, loadMoreBeforeMessage,
    });

  const search = useChatRoomSearch({
    containerRef: messagesContainerRef,
    loadMoreBeforeMessage: () => loadMoreBeforeMessage('before'),
  });

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'k') {
        e.preventDefault();
        if (search.isSearchMode) search.exitSearchMode();
        else { search.enterSearchMode(); setTimeout(() => searchInputRef.current?.focus(), 100); }
        return;
      }
      if (e.key === 'Escape') {
        if (viewerVisible) return;
        if (search.isSearchMode) search.exitSearchMode();
        else if (isSidePanelOpen) setIsSidePanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search, isSidePanelOpen, viewerVisible]);

  if (!storeRoomId && !isNewRoom) return <div className="flex-1 bg-background" />;

  const lastMessageId = lastMessage?.message?.id || messages[messages.length - 1]?.id || '';
  const unreadBoundaryIndex = showUnreadSeparator && initialNotReadCount > 0
    ? Math.max(0, messages.length - initialNotReadCount) : -1;

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden bg-background" {...dragHandlers}>
        <ChatRoomHeader
          roomName={roomName}
          totalUserCount={totalUserCount}
          onBack={() => router.push(routePrefix)}
          search={search}
          searchInputRef={searchInputRef}
          isSidePanelOpen={isSidePanelOpen}
          onToggleSidePanel={() => setIsSidePanelOpen(prev => !prev)}
        />
        {effectiveRoomId && <NoticeBanner roomId={effectiveRoomId} channelType={channelType} />}

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className={cn('h-full px-4 py-2', isRoomTransitioning || messages.length === 0 ? 'overflow-hidden' : 'scrollbar-thin overflow-y-auto')}
          >
            <div ref={messagesContentRef} className={cn((isNewRoom || (!isRoomTransitioning && messages.length === 0 && !lastMessage)) && 'h-full')}>
              {isRoomTransitioning || (!isNewRoom && messages.length === 0 && lastMessage) ? (
                <MessageSkeleton />
              ) : (isNewRoom || messages.length === 0) ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <img src="/signup-complete.png" alt="꿀벌" className="h-[120px] w-[120px] object-contain" />
                  <span className="text-sub text-text-tertiary">메시지를 입력하여 대화를 시작하세요.</span>
                </div>
              ) : (
                <>
                  {isBeforeLoading && (
                    <div className="flex justify-center py-2">
                      <span className="text-sub-sm text-text-tertiary">불러오는 중...</span>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={msg.id}>
                      {idx === unreadBoundaryIndex && (
                        <div id="unread-separator" className="my-3 flex items-center gap-3">
                          <div className="flex-1 border-t border-state-primary/40" />
                          <span className="shrink-0 text-[11px] font-medium text-state-primary/70">여기까지 읽었습니다</span>
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
                        onSetNotice={handleSetNotice}
                        onDeleteMessage={deleteMessage}
                        onEditTag={handleOpenUpdateTag}
                        onRetryMessage={retryTextMessage}
                        onRemoveFailedMessage={removeFailedMessage}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>
          <SelectedTagOverlay />
        </div>

        {isTagOpen && <TagSelectPanel onConfirm={handleTagConfirm} />}
        <ChatInput onSend={handleSendWithTags} onFilesSelected={handleFilesSelected} onEditTag={handleOpenAddTag} />
      </main>

      <SidePanel
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        roomId={effectiveRoomId}
        channelType={channelType}
        lastMessageId={lastMessageId}
      />
      <MediaViewer
        visible={viewerVisible}
        items={allMediaItems}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={closeMediaViewer}
      />
      {pendingItems.length > 0 && (
        <FileConfirmDialog items={pendingItems} onConfirm={handleFileConfirm} onCancel={clearPendingItems} />
      )}
    </div>
  );
}

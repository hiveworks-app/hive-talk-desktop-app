'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { buildFallbackMember } from '@/features/members/fallbackMember';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import { useCreateNoticeMutation } from '@/features/chat-room/notice/queries';
import { toNoticeRequestMeta } from '@/features/chat-room/notice/noticeUtils';
import type { NoticeRequest } from '@/features/chat-room/notice/type';
import { ROOM_NOTICE_KEY } from '@/shared/config/queryKeys';
import { useChatRoomActions } from '@/features/chat-room/useChatRoomActions';
import { useChatRoomController } from '@/features/chat-room/useChatRoomController';
import { useChatRoomSearch } from '@/features/chat-room/useChatRoomSearch';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useCalendarDateJump } from '@/features/chat-room/useCalendarDateJump';
import { useGetTagInfo } from '@/features/tag/queries';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useRecentTagUsageStore } from '@/store/tag/recentTagUsageStore';
import { cn } from '@/shared/lib/cn';
import { ChatMessageUI, WS_CHANNEL_TYPE, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import { IconArrowDown, IconChatScrollBottom } from '@assets/icons';
import { isBlockedUser, useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store/uiStore';
import { ChatInput } from './ChatInput';
import { ChatRoomHeader } from './ChatRoomHeader';
import { FileConfirmDialog } from './FileConfirmDialog';
import { MessageBubble } from './MessageBubble';
import { ReportMessageDialog } from './ReportMessageDialog';
import { MessageSkeleton } from './MessageSkeleton';
import { NoticeBanner } from './NoticeBanner';
import { NoticePill } from './NoticePill';
import { StartConversationEmptyState } from './StartConversationEmptyState';
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
  const isOnline = useOnlineStatus();
  const scrollToBottomTrigger = useChatRoomRuntimeStore(s => s.scrollToBottomTrigger);
  const isRoomTransitioning = !isNewRoom && storeRoomId !== runtimeRoomId;
  const { roomName, totalUserCount, channelType, lastMessage, initialNotReadCount } = useChatRoomInfo();
  const effectiveRoomId = isNewRoom ? '' : (storeRoomId || runtimeRoomId || '');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // 공지 교체 확인 — 기존 공지가 있을 때만 (RN showConfirm 패리티)
  const [noticeReplaceConfirm, setNoticeReplaceConfirm] = useState<{ run: () => void } | null>(null);
  // 장문 전체보기 다이얼로그 (RN ChatRoomFullMessageScreen 대응)
  const [fullTextMessage, setFullTextMessage] = useState<ChatMessageUI | null>(null);
  // 발신자 프로필 다이얼로그 — 멤버목록 미발견 시 미등록 처리 (RN 패리티)
  const [profileTarget, setProfileTarget] = useState<{ member: MemberItem; unregistered: boolean } | null>(null);
  const handleOpenProfile = useCallback((message: ChatMessageUI) => {
    if (!message.senderId) return;
    const members = queryClient.getQueryData<MemberItem[]>(MEMBERS_KEY) ?? [];
    const found = members.find(m => String(m.userId) === String(message.senderId));
    setProfileTarget(
      found
        ? { member: found, unregistered: false }
        : {
            member: buildFallbackMember({
              userId: String(message.senderId),
              name: message.name,
              thumbnailProfileUrl: message.thumbnailProfileUrl,
              isExternal: channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
            }),
            unregistered: true,
          },
    );
  }, [queryClient, channelType]);

  // 차단 메시지 펼침 상태 (messageId 기준) — 방 재진입 시 컴포넌트 재마운트로 자동 초기화 (RN 패리티)
  const [expandedBlockedIds, setExpandedBlockedIds] = useState<Set<string>>(() => new Set());
  // 차단 목록 변경 시 버블 접힘 즉시 반영 (구독 목적 — 값 미사용)
  useBlockedMembersStore(s => s.items);
  const toggleBlockExpand = useCallback((messageId: string) => {
    setExpandedBlockedIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);
  const reportRoomType =
    channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? 'GM'
      : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? 'EM'
        : 'DM';
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { mutate: createNotice } = useCreateNoticeMutation(effectiveRoomId, channelType);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const handleSetNotice = useCallback((message: ChatMessageUI) => {
    // 공지 v2 요청 — { title, messageContentType, payload } (RN 7/3 API 개정 패리티).
    // 서버가 메시지 path를 공지 전용 경로로 자동 복제해 원본과 물리 분리한다.
    const NOTICE_TITLE = '공지사항';
    const file = message.files?.[0];
    const body: NoticeRequest =
      message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
      message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
      message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE
        ? {
            title: NOTICE_TITLE,
            messageContentType: message.messageContentType,
            payload: { path: file?.path ?? '', meta: toNoticeRequestMeta(file?.meta) },
          }
        : {
            title: NOTICE_TITLE,
            messageContentType: WS_MESSAGE_CONTENT_TYPE.TEXT,
            payload: { content: message.text ?? '' },
          };

    const doCreate = () =>
      createNotice(body, {
        onSuccess: () => showSnackbar({ message: '공지가 등록되었습니다.' }),
        onError: () => showSnackbar({ message: '공지 등록에 실패했습니다.', state: 'error' }),
      });

    // 기존 공지가 없으면 즉시 등록, 있으면 변경 확인 (RN 패리티)
    const currentNotice = queryClient.getQueryData(ROOM_NOTICE_KEY(effectiveRoomId, channelType));
    if (!currentNotice) {
      doCreate();
      return;
    }
    // 기존 공지 존재 — 디자인 컨펌으로 교체 확인 (정책: "공지를 변경할까요?" / 취소·변경, RN 패리티)
    setNoticeReplaceConfirm({ run: doCreate });
  }, [createNotice, showSnackbar, queryClient, effectiveRoomId, channelType]);

  // 태그 빠른선택 토글 — 이미 달린 태그면 해제, 아니면 3개 제한 검사 후 부착 (RN handleQuickTagToggle 패리티)
  const { tagList } = useGetTagInfo();
  const handleQuickTagToggle = useCallback((message: ChatMessageUI, tagName: string) => {
    if (isOffline()) return;
    const existing = message.tags?.find(t => t.title === tagName);
    if (existing?.taggingId) {
      removeTagFromMessage({ messageId: message.id, taggingIdList: [String(existing.taggingId)] });
    } else {
      if ((message.tags?.length ?? 0) >= 3) {
        showSnackbar({ message: '태그는 최대 3개까지 선택 가능해요.', state: 'error' });
        return;
      }
      const tag = tagList?.find(t => t.title === tagName);
      if (!tag) return;
      addTagToMessage({ messageId: message.id, tagIdList: [String(tag.tagId)] });
    }
    useRecentTagUsageStore.getState().record(tagName);
  }, [tagList, addTagToMessage, removeTagFromMessage, showSnackbar]);

  const { isTagOpen, handleOpenAddTag, handleOpenUpdateTag, handleTagConfirm, handleSendWithTags } =
    useTagActions({ roomId: effectiveRoomId, sendTextMessage, addTagToMessage, removeTagFromMessage });
  const { pendingItems, clearPendingItems, handleFileConfirm, handleFilesSelected, dragHandlers } =
    useFileDragDrop({ onMediaSend: sendMediaMessage, onDocSend: sendDocumentMessage });
  const { viewerIndex, setViewerIndex, viewerVisible, allMediaItems, openMediaViewer, closeMediaViewer } =
    useMediaViewer(
      messages,
      // 방 전체 첨부 탐색용 — lastMessage가 있어야 히스토리 커서를 잡을 수 있다
      effectiveRoomId && lastMessage?.message.id
        ? { roomId: effectiveRoomId, channelType, lastMessageId: lastMessage.message.id }
        : undefined,
    );
  // 시스템 메시지(입장/퇴장/공지/제목변경 등)는 '새 메시지 보기' 버튼을 유발하지 않음 (RN 패리티)
  const lastMsgType = messages[messages.length - 1]?.messageContentType;
  const lastMessageIsSystem =
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE ||
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT ||
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE ||
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE ||
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE ||
    lastMsgType === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED;
  const { messagesEndRef, messagesContainerRef, messagesContentRef, handleScroll, showUnreadSeparator, isAwayFromBottom, hasNewWhileAway, scrollToBottom } =
    useScrollManagement({
      messagesLength: messages.length, isRoomTransitioning, storeRoomId,
      initialNotReadCount, scrollToBottomTrigger, hasMoreBefore, isBeforeLoading, loadMoreBeforeMessage,
      lastMessageIsSystem,
    });

  const search = useChatRoomSearch({
    containerRef: messagesContainerRef,
    loadMoreBeforeMessage: () => loadMoreBeforeMessage('before'),
  });

  // 안읽음 구분선 앵커 — 최초 산정 시점에 메시지 ID로 고정 (RN unreadSeparatorMessageId 패리티).
  // 인덱스 근사(length - notReadCount)만 쓰면 이전 페이지 로드·중간 삭제 시 구분선이 밀린다.
  const [unreadSeparatorMessageId, setUnreadSeparatorMessageId] = useState<string | null>(null);
  const separatorRoomRef = useRef<string | null>(null);
  useEffect(() => {
    // setState는 setTimeout(0)으로 이연 — react-hooks/set-state-in-effect 대응 (코드베이스 공통 패턴)
    if (separatorRoomRef.current !== storeRoomId) {
      separatorRoomRef.current = storeRoomId;
      const t = setTimeout(() => setUnreadSeparatorMessageId(null), 0);
      return () => clearTimeout(t);
    }
    if (unreadSeparatorMessageId !== null) return; // 이미 고정 — 이후 목록 변화에 불변
    if (!showUnreadSeparator || initialNotReadCount <= 0 || messages.length === 0) return;
    const idx = Math.max(0, messages.length - initialNotReadCount);
    const id = messages[idx]?.id;
    if (!id) return;
    const t = setTimeout(() => setUnreadSeparatorMessageId(id), 0);
    return () => clearTimeout(t);
  }, [storeRoomId, messages, initialNotReadCount, showUnreadSeparator, unreadSeparatorMessageId]);

  // 캘린더 날짜 검색 — 검색 포커스와 동일한 data-msg-index 스크롤 메커니즘 재사용
  const scrollToIndexForCalendar = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const el = messagesContainerRef.current?.querySelector(`[data-msg-index="${index}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [messagesContainerRef]);
  const { handleCalendarDateSelect, isCalendarLoading } = useCalendarDateJump({
    roomId: effectiveRoomId,
    channelType,
    scrollToIndex: scrollToIndexForCalendar,
  });

  // 검색 모드 진입 시 차단 메시지 전부 접힘으로 초기화 (정책 — RN 패리티)
  // effect 대신 렌더 중 상태 보정 패턴 사용 (react-hooks/set-state-in-effect 준수)
  const [prevSearchMode, setPrevSearchMode] = useState(search.isSearchMode);
  if (search.isSearchMode !== prevSearchMode) {
    setPrevSearchMode(search.isSearchMode);
    if (search.isSearchMode) setExpandedBlockedIds(new Set());
  }

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
  // '대화 시작 전' 초기화면 노출 여부 — 노출 시 채팅 배경(chat-bg)을 가장자리까지 채우기 위해 패딩 제거
  const showEmptyState =
    !(isRoomTransitioning || (!isNewRoom && messages.length === 0 && lastMessage)) &&
    (isNewRoom || messages.length === 0);

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden bg-background" {...dragHandlers}>
        <ChatRoomHeader
          roomName={roomName}
          isExternalRoom={channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE}
          totalUserCount={totalUserCount}
          onBack={() => router.push(routePrefix)}
          search={search}
          searchInputRef={searchInputRef}
          isSidePanelOpen={isSidePanelOpen}
          onToggleSidePanel={() => setIsSidePanelOpen(prev => !prev)}
          onCalendarDateSelect={date => void handleCalendarDateSelect(date)}
          isCalendarLoading={isCalendarLoading}
        />

        {/* 채팅 본문(메시지+입력창) 래퍼 — 업무태그 바텀시트 오버레이의 기준(relative) */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="relative flex-1 overflow-hidden bg-chat-bg">
          {/* 공지 배너 — 절대 위치 오버레이: 펼침/접힘이 메시지 레이아웃(스크롤·위치)에 영향 주지 않도록 띄운다 */}
          {effectiveRoomId && (
            <div className="absolute inset-x-0 top-0 z-20">
              <NoticeBanner roomId={effectiveRoomId} channelType={channelType} />
            </div>
          )}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className={cn('h-full', !showEmptyState && 'px-4 py-2', isRoomTransitioning || messages.length === 0 ? 'overflow-hidden' : 'scrollbar-thin overflow-x-hidden overflow-y-auto')}
          >
            <div ref={messagesContentRef} className={cn((isNewRoom || (!isRoomTransitioning && messages.length === 0 && !lastMessage)) && 'h-full')}>
              {isRoomTransitioning || (!isNewRoom && messages.length === 0 && lastMessage) ? (
                <MessageSkeleton />
              ) : (isNewRoom || messages.length === 0) ? (
                /* RN 패리티 — GM(3인 이상) 빈 방은 방 이름 변경 안내 문구 */
                <StartConversationEmptyState
                  message={
                    totalUserCount >= 3
                      ? '채팅방 이름을 변경하면,\n모두에게 같은 이름으로 변경돼요!'
                      : undefined
                  }
                />
              ) : (
                <>
                  {/* 오프라인 sentinel — 스피너 대신 왜 더 안 불러오는지 명시 (RN OfflinePaginationSentinel 패리티) */}
                  {!isOnline && hasMoreBefore && (
                    <div className="flex justify-center py-3">
                      <span className="text-sub-sm text-text-tertiary">
                        오프라인 상태에서는 이전 메시지를 불러올 수 없습니다
                      </span>
                    </div>
                  )}
                  {isBeforeLoading && (
                    <div className="flex justify-center py-2">
                      <span className="text-sub-sm text-text-tertiary">불러오는 중...</span>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={msg.id}>
                      {/* 안읽음 구분선 — 날짜 구분선과 동일한 중앙 pill 스타일 (RN UnreadSeparator 패리티) */}
                      {msg.id === unreadSeparatorMessageId && (
                        <div id="unread-separator" className="mb-2 mt-5">
                          <NoticePill>여기까지 읽었어요.</NoticePill>
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
                        onReportMessage={setReportTargetId}
                        onQuickTagToggle={handleQuickTagToggle}
                        onOpenProfile={handleOpenProfile}
                        onExpandFullText={setFullTextMessage}
                        isBlockedSender={msg.sender === 'other' && isBlockedUser(msg.senderId)}
                        isBlockExpanded={expandedBlockedIds.has(msg.id)}
                        onToggleBlockExpand={toggleBlockExpand}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>
          {/* 스크롤 최하단/새 메시지 보기 플로팅 버튼 (RN NewMessageButton 패리티 — 새 메시지 시 노랑 pill) */}
          {isAwayFromBottom && !isRoomTransitioning && messages.length > 0 && (
            hasNewWhileAway ? (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-2.5 right-2.5 z-30 flex items-center gap-1.5 rounded-[10px] bg-[rgba(255,217,0,0.5)] px-2.5 py-1.5 text-body font-medium text-gray-900 shadow-[0px_2px_9px_rgba(0,0,0,0.07)] transition-opacity hover:opacity-90"
              >
                새 메시지 보기
                <IconArrowDown width={13} height={16} className="text-gray-900" />
              </button>
            ) : (
              <button
                onClick={scrollToBottom}
                aria-label="맨 아래로"
                className="absolute bottom-2.5 right-2.5 z-30 flex size-10 items-center justify-center rounded-xl bg-white shadow-[0px_2px_10px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
              >
                <IconChatScrollBottom width={20} height={11} className="text-gray-700" />
              </button>
            )
          )}
          <SelectedTagOverlay />
        </div>

          <ChatInput onSend={handleSendWithTags} onFilesSelected={handleFilesSelected} onEditTag={handleOpenAddTag} />

          {/* 공지 교체 확인 (RN 정책 카피) */}
      <ConfirmDialog
        open={noticeReplaceConfirm !== null}
        title="공지를 변경할까요?"
        description="기존 공지가 새 공지로 변경돼요."
        confirmLabel="변경"
        cancelLabel="취소"
        onConfirm={() => {
          noticeReplaceConfirm?.run();
          setNoticeReplaceConfirm(null);
        }}
        onCancel={() => setNoticeReplaceConfirm(null)}
      />

      {/* 장문 전체보기 (RN 전용 화면 대응 — 데스크톱은 다이얼로그) */}
      {fullTextMessage && (
        <div className="electron-no-drag animate-fade-in-fast fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setFullTextMessage(null)}>
          <div
            className="animate-pop-in flex max-h-[80vh] w-[min(560px,calc(100vw-48px))] flex-col rounded-2xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-divider px-5 py-3">
              <span className="text-sub font-bold text-text-primary">{fullTextMessage.name}</span>
              <button
                onClick={() => setFullTextMessage(null)}
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
              >
                ✕
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap text-body text-text-primary [overflow-wrap:anywhere]">{fullTextMessage.text}</p>
            </div>
            <div className="border-t border-divider px-5 py-3">
              <button
                onClick={() => { navigator.clipboard.writeText(fullTextMessage.text); }}
                className="text-sub-sm font-medium text-primary hover:underline"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 발신자 프로필 다이얼로그 (DM에서는 [1:1 채팅] 비활성 — 이미 그 방) */}
      <UserProfileDialog
        isOpen={profileTarget !== null}
        onClose={() => setProfileTarget(null)}
        member={profileTarget?.member ?? null}
        unregistered={profileTarget?.unregistered}
        disableDirectChat={channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE}
      />

      {/* 업무태그 바텀시트 — 채팅 본문 위 오버레이 (딤은 메시지+입력창만 덮음) */}
          {isTagOpen && <TagSelectPanel onConfirm={handleTagConfirm} />}
        </div>
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
      {reportTargetId !== null && (
        <ReportMessageDialog
          open
          roomType={reportRoomType}
          roomId={effectiveRoomId}
          messageId={reportTargetId}
          onClose={() => setReportTargetId(null)}
        />
      )}
    </div>
  );
}

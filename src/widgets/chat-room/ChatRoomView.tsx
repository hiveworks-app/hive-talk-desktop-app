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
import { optimisticTagRemoveGuard } from '@/features/chat-room/optimisticTagRemoveGuard';
import { isConfirmedTaggingId, pendingTagRemoveRegistry } from '@/features/chat-room/pendingTagRemoveRegistry';
import { useChatRoomActions } from '@/features/chat-room/useChatRoomActions';
import { useChatRoomController } from '@/features/chat-room/useChatRoomController';
import { useChatRoomSearch } from '@/features/chat-room/useChatRoomSearch';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useCalendarDateJump } from '@/features/chat-room/useCalendarDateJump';
import { useGetTagInfo } from '@/features/tag/queries';
import { isOffline } from '@/shared/utils/offlineGuard';
import { acquireEscSuppress, isEscSuppressed } from '@/shared/utils/escSuppress';
import { closeIfPopup } from '@/shared/utils/popupWindow';
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
  /** 멀티 채팅창(팝업) — 목록이 없는 단독 창이라 뒤로가기·목록 복귀 대신 방 메타를 직접 부트스트랩 */
  isPopup?: boolean;
}

export function ChatRoomView({ routePrefix, showNextMessage = false, isPopup = false }: ChatRoomViewProps) {
  const params = useParams();
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const urlRoomId = params?.roomId as string | undefined;

  const storeRoomId = useChatRoomInfo(s => s.roomId);
  const invitedUserIds = useChatRoomInfo(s => s.invitedUserIds);
  const isNewRoom = !storeRoomId && invitedUserIds.length > 0;

  useEffect(() => {
    // 팝업은 페이지가 방 메타를 채운 뒤 마운트하므로 목록 복귀 대상이 아니다
    if (!storeRoomId && !isNewRoom && urlRoomId && !isPopup) router.replace(routePrefix);
  }, [storeRoomId, isNewRoom, urlRoomId]);

  useChatRoomController();

  const { sendTextMessage, sendMediaMessage, sendDocumentMessage, loadMoreBeforeMessage, loadMoreAfterMessage, deleteMessage, addTagToMessage, removeTagFromMessage, refreshMessageTags, retryTextMessage, removeFailedMessage } =
    useChatRoomActions();
  const messages = useChatRoomRuntimeStore(s => s.messages);
  const runtimeRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const { hasMoreBefore, isBeforeLoading, hasMoreAfter, isAfterLoading } = useChatRoomRuntimeStore(s => s.loading);
  const isOnline = useOnlineStatus();
  const scrollToBottomTrigger = useChatRoomRuntimeStore(s => s.scrollToBottomTrigger);
  const isRoomTransitioning = !isNewRoom && storeRoomId !== runtimeRoomId;
  const { roomName, totalUserCount, channelType, lastMessage, initialNotReadCount } = useChatRoomInfo();

  // 팝업 창 제목을 방 이름으로 — 창 전환(⌘`)·미션컨트롤에서 방 구분
  useEffect(() => {
    if (isPopup && roomName) document.title = roomName;
  }, [isPopup, roomName]);
  const effectiveRoomId = isNewRoom ? '' : (storeRoomId || runtimeRoomId || '');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  // 공지 교체 확인 — 기존 공지가 있을 때만 (RN showConfirm 패리티)
  const [noticeReplaceConfirm, setNoticeReplaceConfirm] = useState<{ run: () => void } | null>(null);
  // 장문 전체보기 다이얼로그 (RN ChatRoomFullMessageScreen 대응)
  const [fullTextMessage, setFullTextMessage] = useState<ChatMessageUI | null>(null);
  // 장문 전체보기 — ESC로 닫기 + Electron 창 숨김 억제 (억제 없으면 ESC가 앱을 트레이로 숨긴다)
  useEffect(() => {
    if (!fullTextMessage) return;
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        setFullTextMessage(null);
      }
    };
    // capture — 아래의 방 공용 ESC 핸들러(검색/사이드패널)보다 먼저 소비
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      release();
    };
  }, [fullTextMessage]);
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
    if (existing) {
      // 낙관적 제거 — 서버 왕복(미확정 태그면 재조회 포함 2회)을 기다리지 않고 칩을 즉시 내린다.
      // 서버 처리는 뒤에서 진행되고, REMOVE 브로드캐스트 병합이 최종 상태를 확정한다
      // (태그 패널 UPDATE 경로의 기존 낙관적 반영과 동일 원칙).
      const snapshotTags = message.tags ?? [];
      useChatRoomRuntimeStore.getState().setMessages(prev =>
        prev.map(m =>
          m.id === message.id
            ? { ...m, tags: (m.tags ?? []).filter(t => String(t.tagId) !== String(existing.tagId)) }
            : m,
        ),
      );
      // 실패 안전망 — 제한 시간 내 REMOVE 브로드캐스트가 없으면 복구 + 안내 (2026-08-27 UX 결정)
      optimisticTagRemoveGuard.arm(message.id, () => {
        pendingTagRemoveRegistry.cancel(message.id);
        useChatRoomRuntimeStore.getState().setMessages(prev =>
          prev.map(m => (m.id === message.id ? { ...m, tags: snapshotTags } : m)),
        );
        showSnackbar({ message: '태그 해제에 실패했어요. 잠시 후 다시 시도해주세요.', state: 'error' });
      });
      if (isConfirmedTaggingId(existing.taggingId)) {
        removeTagFromMessage({ messageId: message.id, taggingIdList: [String(existing.taggingId)] });
      } else {
        // 전송 직후 미확정(-1) 창 — 서버는 확정 브로드캐스트를 안 주므로(실측),
        // 이 메시지 앵커로 히스토리를 재조회해 확정 taggingId 도착 시 제거를 발사한다
        pendingTagRemoveRegistry.mark(message.id, Number(existing.tagId), taggingIdList =>
          removeTagFromMessage({ messageId: message.id, taggingIdList }),
        );
        refreshMessageTags(message.id);
      }
    } else {
      if ((message.tags?.length ?? 0) >= 3) {
        showSnackbar({ message: '태그는 최대 3개까지 선택 가능해요.', state: 'warning' });
        return;
      }
      const tag = tagList?.find(t => t.title === tagName);
      if (!tag) return;
      addTagToMessage({ messageId: message.id, tagIdList: [String(tag.tagId)] });
    }
    useRecentTagUsageStore.getState().record(tagName);
  }, [tagList, addTagToMessage, removeTagFromMessage, refreshMessageTags, showSnackbar]);

  const { isTagOpen, handleOpenAddTag, handleOpenUpdateTag, handleTagConfirm, handleSendWithTags } =
    useTagActions({ roomId: effectiveRoomId, sendTextMessage, addTagToMessage, removeTagFromMessage, refreshMessageTags });
  const { pendingItems, removePendingItem, clearPendingItems, handleFileConfirm, handleFilesSelected, dragHandlers } =
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
      // 아래(최신) 방향 — 캘린더 점프 후 복귀 경로 (RN onEndReached 패리티)
      hasMoreAfter, isAfterLoading, loadMoreAfterMessage,
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
        // 위 레이어가 이미 소비한 ESC는 무시 — Radix 레이어는 capture 단계에서 preventDefault,
        // 전역 오버레이(미디어 뷰어·프로필·커서 메뉴)는 escSuppress를 잡는다. IME 조합 취소도 제외.
        if (e.defaultPrevented || e.isComposing || isEscSuppressed()) return;
        if (viewerVisible) return;
        if (pendingItems.length > 0) return; // 파일 전송 확인 다이얼로그가 자체적으로 ESC=취소 처리
        if (search.isSearchMode) search.exitSearchMode();
        else if (isSidePanelOpen) setIsSidePanelOpen(false);
        // 모든 레이어를 벗겨낸 뒤의 ESC — 팝업 창은 창 자체를 닫는다 (메인 창에선 no-op.
        // 메인 창의 ESC=트레이 숨김은 Electron main의 before-input-event가 담당)
        else closeIfPopup();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search, isSidePanelOpen, viewerVisible, pendingItems]);

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
          // 방 전환 시 헤더 리마운트 — 캘린더 선택일/열림 등 방 스코프 UI 상태 잔존 방지 (2026-08-26 리뷰)
          key={effectiveRoomId}
          roomName={roomName}
          isExternalRoom={channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE}
          totalUserCount={totalUserCount}
          onBack={() => router.push(routePrefix)}
          isPopup={isPopup}
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
          {/* 공지 배너 — 절대 위치 오버레이: 펼침/접힘이 메시지 레이아웃(스크롤·위치)에 영향 주지 않도록 띄운다.
              검색 모드에선 숨김 — 오버레이가 검색 결과 상단을 가린다 (RN 패리티) */}
          {effectiveRoomId && !search.isSearchMode && (
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
          {/* 스크롤 최하단/새 메시지 보기 플로팅 버튼 (RN NewMessageButton 패리티 — 새 메시지 시 노랑 pill).
              검색 중에는 숨김 — 결과 탐색 스크롤과 충돌 (RN 패리티).
              새 메시지 강조는 "1화면 이상" 임계와 무관하게 노출 — 100px~1화면 구간에서 새 메시지가
              와도 아무 표시가 없는 사각지대 방지 (하단 근접 시 hasNewWhileAway가 즉시 해제됨) */}
          {(isAwayFromBottom || hasNewWhileAway) && !isRoomTransitioning && !search.isSearchMode && messages.length > 0 && (
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
        </div>

          {/* 선택한 업무태그 — 대화 영역이 아니라 입력창 바로 위 (RN 패리티) */}
          <SelectedTagOverlay />
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
        <FileConfirmDialog items={pendingItems} onConfirm={handleFileConfirm} onCancel={clearPendingItems} onRemoveItem={removePendingItem} />
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

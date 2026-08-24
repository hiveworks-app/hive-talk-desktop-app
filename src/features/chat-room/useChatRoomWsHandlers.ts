'use client';

import { useCallback, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { consumeDraftBackfill } from '@/features/chat-room/draftBackfill';
import { closeIfPopup } from '@/shared/utils/popupWindow';
import { ParticipantsManager } from '@/features/chat-room/domain';
import { useChatRoomWsFetchHandlers } from '@/features/chat-room/useChatRoomWsFetchHandlers';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { TagListType } from '@/shared/types/tag';
import {
  Message, WS_CHANNEL_TYPE, WS_MESSAGE_CONTENT_TYPE, WebSocketChannelTypes, WebSocketEnvelope,
  WebSocketMessageType,
  WebSocketPublishItem, isAddTagBroadcast, isAddTagSession, isBroadcast, isDeleteMessage,
  isExitMessageRoomBroadcast, isExitMessageRoomSession, isFetchAfterMessage, isFetchBeforeMessage,
  isFetchMessage, isMediaFileMessage, isPublish, isReadMessage, isRemoveTagBroadcast,
  isRemoveTagSession, isReportedMessageBroadcast, isReportHiddenBroadcast, isSub, isViewInMessage, isViewOutMessage,
} from '@/shared/types/websocket';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

interface UseChatRoomWsHandlersParams {
  channelType: WebSocketChannelTypes;
  parseWsMessage: ReturnType<typeof createWsMessageParser>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  replaceMessages: (next: Message[]) => void;
  setLoading: (loading: Record<string, unknown>) => void;
  deleteMessageById: (id: string) => void;
  replaceLocalWithServer: (fileId: string, serverMessage: Message) => void;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  participantsManager: ParticipantsManager;
  recalculateAllMessagesNotReadCount: (participants: ParticipantItemsType[]) => void;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isInitialFetchRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
  /** draft 백필용 — 첫 PUB 수신 시 FETCH_BEFORE 1회 발행 */
  send: (msg: unknown) => void;
  buildFetchBeforeMessage: (opts: { currentMessage: string; isInclusive: boolean; channelIdOverride: string }) => unknown;
}

export const useChatRoomWsHandlers = (params: UseChatRoomWsHandlersParams) => {
  const {
    channelType, parseWsMessage, setMessages, deleteMessageById,
    replaceLocalWithServer, participantsManager, recalculateAllMessagesNotReadCount, isMountedRef,
    send, buildFetchBeforeMessage,
  } = params;
  const queryClient = useQueryClient();
  const router = useAppRouter();

  const { handleFetchBeforeHistory, handleFetchAfterHistory, handleReadMessage } =
    useChatRoomWsFetchHandlers(params);

  const handleExitMessageRoom = useCallback((roomId: string) => {
    const roomListKey = channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? GM_ROOM_LIST_KEY : DM_ROOM_LIST_KEY;
    queryClient.setQueryData<GetChatRoomListItemType[]>(roomListKey, oldData =>
      oldData ? oldData.filter(item => item.roomModel.roomId !== roomId) : [],
    );
    // 다른 창/기기에서 이 방을 나가면 팝업에도 같은 브로드캐스트가 온다 —
    // 팝업은 목록으로 가지 않고 창을 닫는다
    if (closeIfPopup()) return;
    router.push('/chat');
  }, [channelType, queryClient, router]);

  const handleTagBroadcast = useCallback((targetMessageId: string, items: TagListType[]) => {
    const normalized = items.map(item => ({ ...item, tagId: Number(item.tagId), categoryId: Number(item.categoryId) }));
    const seen = new Set<number>();
    const dedup = normalized.filter(item => { if (seen.has(item.tagId)) return false; seen.add(item.tagId); return true; });
    setMessages(prev => prev.map(m => (m.id === targetMessageId ? { ...m, tags: dedup } : m)));
  }, [setMessages]);

  // 신고 마스킹: REPORTED → 마스킹 텍스트(TEXT) / REPORT_HIDDEN → 시스템 안내(SYSTEM_REPORTED)
  const maskReportedMessage = useCallback(
    (messageId: string, content: string, contentType: WebSocketMessageType) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, text: content, messageContentType: contentType, files: [], tags: [] } : m,
        ),
      );
    },
    [setMessages],
  );

  const handleParticipantChange = useCallback((eventType: 'EXIT' | 'INVITE', roomId: string) => {
    participantsManager.refetchParticipants(roomId, channelType).then(() => {
      if (!isMountedRef.current) return;
      const participants = participantsManager.getParticipants(roomId, channelType);
      useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
      recalculateAllMessagesNotReadCount(participants);
    }).catch(error => { console.error(`[WS] SUBMIT_${eventType} refetch 실패:`, error); });
  }, [participantsManager, channelType, recalculateAllMessagesNotReadCount, isMountedRef]);

  const handlePublishMessage = useCallback((payload: WebSocketPublishItem, roomId: string) => {
    // draft 생성 직후 첫 PUB — 생성 트랜잭션과 함께 발행된 시스템 메시지(초대 공지)는
    // SUB 전이라 broadcast로 못 받는다 → 이 메시지를 앵커로 1회 BEFORE 회수 (RN 패리티)
    if (consumeDraftBackfill(roomId) && payload.message?.id) {
      send(buildFetchBeforeMessage({
        currentMessage: payload.message.id,
        isInclusive: false,
        channelIdOverride: roomId,
      }));
    }

    const m = parseWsMessage({ item: payload });
    if (!m) return;

    const incomingFileId = isMediaFileMessage(payload.message)
      ? (payload.message.payload.fileId ?? undefined) : undefined;
    if (incomingFileId) {
      const { messages } = useChatRoomRuntimeStore.getState();
      if (messages.some(msg => msg.fileId === incomingFileId && msg.isLocal)) {
        replaceLocalWithServer(incomingFileId, m);
        return;
      }
    }

    // Optimistic 텍스트 메시지: 로컬 메시지를 서버 메시지로 교체 (가장 오래된 것부터)
    if (m.sender === 'me' && !incomingFileId) {
      const { messages } = useChatRoomRuntimeStore.getState();
      const localTextId = messages.find(msg => msg.isLocal && msg.localStatus !== 'failed' && msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT)?.id;
      if (localTextId) {
        useChatRoomRuntimeStore.setState(state => ({
          messages: state.messages.map(msg =>
            msg.id === localTextId ? { ...m, isLocal: false } : msg,
          ),
        }));
        return;
      }
    }

    setMessages(prev => (prev.some(msg => msg.id === m.id) ? prev : [...prev, m]));

    if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
      handleParticipantChange('EXIT', roomId);
    } else if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
      handleParticipantChange('INVITE', roomId);
    }
  }, [parseWsMessage, replaceLocalWithServer, setMessages, handleParticipantChange, send, buildFetchBeforeMessage]);

  const extractTagTarget = (payload: { items: TagListType[] } & Record<string, unknown>) =>
    payload.items[0]?.messageId ?? (payload.messageId as string | undefined);

  const handleWsMessage = useCallback((data: WebSocketEnvelope) => {
    const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
    if (!roomId) return;
    if (isViewInMessage(data) || isViewOutMessage(data)) return;
    if (isExitMessageRoomSession(data)) { handleExitMessageRoom(roomId); return; }
    if (isFetchMessage(data) || isFetchBeforeMessage(data)) { handleFetchBeforeHistory(data.response.payload, roomId); return; }
    if (isFetchAfterMessage(data)) { handleFetchAfterHistory(data.response.payload, roomId); return; }
    if (isAddTagSession(data) || isRemoveTagSession(data)) return;
    if (!isBroadcast(data)) return;

    // 신고 마스킹(REPORTED/REPORT_HIDDEN) — REPORTED엔 response.channelType이 없어 채널 필터보다 먼저 처리
    if (isReportedMessageBroadcast(data)) {
      const p = data.response.payload;
      if (p.roomId === roomId && p.messageId) maskReportedMessage(p.messageId, p.content, WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK);
      return;
    }
    if (isReportHiddenBroadcast(data)) {
      const p = data.response.payload;
      if (p.roomId === roomId && p.messageId) maskReportedMessage(p.messageId, p.content, WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED);
      return;
    }

    if (data.response.channelType !== channelType) return;
    if (isSub(data)) return;

    if (isDeleteMessage(data)) { deleteMessageById(data.response.payload.message.id); return; }
    if (isReadMessage(data)) { handleReadMessage(data.response.payload?.items ?? [], roomId); return; }
    if (isPublish(data)) {
      const p = data.response.payload;
      // RN useChatRoomController 패리티: 비정상 envelope(message 누락) 방어
      if (p?.message?.roomId === roomId) {
        handlePublishMessage(p, roomId);
      } else if (p?.message?.roomId != null) {
        // 에코가 여기서 조용히 버려지면 5초 타임아웃 실패가 된다 — 타입 불일치 추적용
        console.warn('[WS] PUB 무시 — roomId 불일치:', p.message.roomId, '(현재:', roomId, ')');
      }
      return;
    }
    if (isExitMessageRoomBroadcast(data)) {
      const loginUserId = String(useAuthStore.getState().user?.id ?? '');
      if (String(data.response.payload?.userId) === loginUserId) handleExitMessageRoom(roomId);
    }
    if (isAddTagBroadcast(data)) {
      const p = data.response.payload;
      const target = extractTagTarget(p);
      if (target) handleTagBroadcast(target, p.items);
      return;
    }
    if (isRemoveTagBroadcast(data)) {
      const p = data.response.payload;
      const pendingId = useChatRoomRuntimeStore.getState().pendingRemoveTagMessageId;
      const target = extractTagTarget(p) ?? pendingId;
      if (target) handleTagBroadcast(target, p.items);
      useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
    }
  }, [
    handleExitMessageRoom, handleFetchBeforeHistory, handleFetchAfterHistory,
    handleTagBroadcast, deleteMessageById, handleReadMessage, handlePublishMessage, channelType,
    maskReportedMessage,
  ]);

  return { handleWsMessage };
};

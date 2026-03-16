'use client';

import { useCallback, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager } from '@/features/chat-room/domain';
import { useChatRoomWsFetchHandlers } from '@/features/chat-room/useChatRoomWsFetchHandlers';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { TagListType } from '@/shared/types/tag';
import {
  Message, WS_CHANNEL_TYPE, WS_MESSAGE_CONTENT_TYPE, WebSocketChannelTypes, WebSocketEnvelope,
  WebSocketPublishItem, isAddTagBroadcast, isAddTagSession, isBroadcast, isDeleteMessage,
  isExitMessageRoomBroadcast, isExitMessageRoomSession, isFetchAfterMessage, isFetchBeforeMessage,
  isFetchMessage, isMediaFileMessage, isPublish, isReadMessage, isRemoveTagBroadcast,
  isRemoveTagSession, isSub, isViewInMessage, isViewOutMessage,
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
  addPendingReadEvent: (messageId: string, userId: string) => void;
  participantsManager: ParticipantsManager;
  recalculateAllMessagesNotReadCount: (participants: ParticipantItemsType[]) => void;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isInitialFetchRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
}

export const useChatRoomWsHandlers = (params: UseChatRoomWsHandlersParams) => {
  const {
    channelType, parseWsMessage, setMessages, deleteMessageById,
    replaceLocalWithServer, participantsManager, recalculateAllMessagesNotReadCount, isMountedRef,
  } = params;
  const queryClient = useQueryClient();
  const router = useRouter();

  const { handleFetchBeforeHistory, handleFetchAfterHistory, handleReadMessage } =
    useChatRoomWsFetchHandlers(params);

  const handleExitMessageRoom = useCallback((roomId: string) => {
    const roomListKey = channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? GM_ROOM_LIST_KEY : DM_ROOM_LIST_KEY;
    queryClient.setQueryData<GetChatRoomListItemType[]>(roomListKey, oldData =>
      oldData ? oldData.filter(item => item.roomModel.roomId !== roomId) : [],
    );
    router.push('/chat');
  }, [channelType, queryClient, router]);

  const handleTagBroadcast = useCallback((targetMessageId: string, items: TagListType[]) => {
    const normalized = items.map(item => ({ ...item, tagId: Number(item.tagId), categoryId: Number(item.categoryId) }));
    const seen = new Set<number>();
    const dedup = normalized.filter(item => { if (seen.has(item.tagId)) return false; seen.add(item.tagId); return true; });
    setMessages(prev => prev.map(m => (m.id === targetMessageId ? { ...m, tags: dedup } : m)));
  }, [setMessages]);

  const handleParticipantChange = useCallback((eventType: 'EXIT' | 'INVITE', roomId: string) => {
    participantsManager.refetchParticipants(roomId, channelType).then(() => {
      if (!isMountedRef.current) return;
      const participants = participantsManager.getParticipants(roomId, channelType);
      useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
      recalculateAllMessagesNotReadCount(participants);
    }).catch(error => { console.error(`[WS] SUBMIT_${eventType} refetch 실패:`, error); });
  }, [participantsManager, channelType, recalculateAllMessagesNotReadCount, isMountedRef]);

  const handlePublishMessage = useCallback((payload: WebSocketPublishItem, roomId: string) => {
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

    setMessages(prev => (prev.some(msg => msg.id === m.id) ? prev : [...prev, m]));

    if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
      handleParticipantChange('EXIT', roomId);
    } else if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
      handleParticipantChange('INVITE', roomId);
    }
  }, [parseWsMessage, replaceLocalWithServer, setMessages, handleParticipantChange]);

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
    if (data.response.channelType !== channelType) return;
    if (isSub(data)) return;

    if (isDeleteMessage(data)) { deleteMessageById(data.response.payload.message.id); return; }
    if (isReadMessage(data)) { handleReadMessage(data.response.payload.items, roomId); return; }
    if (isPublish(data)) {
      const p = data.response.payload;
      if (p.message.roomId === roomId) handlePublishMessage(p, roomId);
      return;
    }
    if (isExitMessageRoomBroadcast(data)) {
      const loginUserId = String(useAuthStore.getState().user?.id ?? '');
      if (String(data.response.payload.userId) === loginUserId) handleExitMessageRoom(roomId);
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
  ]);

  return { handleWsMessage };
};

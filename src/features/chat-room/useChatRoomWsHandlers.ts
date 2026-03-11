'use client';

import { useCallback, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import {
  applyReconciliation,
  extractDeletedMessageIds,
} from '@/features/chat-room/reconcileDeletedMessages';
import {
  CHAT_AFTER_SIZE,
  CHAT_BEFORE_SIZE,
} from '@/shared/config/constants';
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
} from '@/shared/config/queryKeys';
import { TagListType } from '@/shared/types/tag';
import {
  Message,
  WS_CHANNEL_TYPE,
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketChannelTypes,
  WebSocketEnvelope,
  WebSocketPublishItem,
  isAddTagBroadcast,
  isAddTagSession,
  isBroadcast,
  isDeleteMessage,
  isExitMessageRoomBroadcast,
  isExitMessageRoomSession,
  isFetchAfterMessage,
  isFetchBeforeMessage,
  isFetchMessage,
  isMediaFileMessage,
  isPublish,
  isReadMessage,
  isRemoveTagBroadcast,
  isRemoveTagSession,
  isSub,
  isViewInMessage,
  isViewOutMessage,
} from '@/shared/types/websocket';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

interface UseChatRoomWsHandlersParams {
  channelType: WebSocketChannelTypes;
  parseWsMessage: ReturnType<typeof createWsMessageParser>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  setLoading: (loading: Record<string, unknown>) => void;
  deleteMessageById: (id: string) => void;
  replaceLocalWithServer: (fileId: string, serverMessage: Message) => void;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  addPendingReadEvent: (messageId: string, userId: string) => void;
  participantsManager: ParticipantsManager;
  recalculateAllMessagesNotReadCount: (participants: ParticipantItemsType[]) => void;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
}

export const useChatRoomWsHandlers = ({
  channelType,
  parseWsMessage,
  setMessages,
  setLoading,
  deleteMessageById,
  replaceLocalWithServer,
  normalizeUserId,
  addPendingReadEvent,
  participantsManager,
  recalculateAllMessagesNotReadCount,
  isReconnectFetchRef,
  isMountedRef,
}: UseChatRoomWsHandlersParams) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleExitMessageRoom = useCallback(
    (roomId: string) => {
      const roomListKey =
        channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? GM_ROOM_LIST_KEY : DM_ROOM_LIST_KEY;

      queryClient.setQueryData<GetChatRoomListItemType[]>(roomListKey, oldData => {
        if (!oldData) return [];
        return oldData.filter(item => item.roomModel.roomId !== roomId);
      });

      router.push('/chat');
    },
    [channelType, queryClient, router],
  );

  const handleFetchBeforeHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const reverse = [...payload].reverse();
      const filtered = reverse.filter(item => item.message.roomId === roomId);

      const mapped = filtered
        .map(item => parseWsMessage({ item }))
        .filter((m): m is Message => m !== null);

      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        const existing = new Set(reconciledPrev.map(m => m.id));
        const dedup = mapped.filter(m => !existing.has(m.id));
        return [...dedup, ...reconciledPrev];
      });

      setLoading({ isBeforeLoading: false });

      if (mapped.length < CHAT_BEFORE_SIZE || mapped.length === 0) {
        setLoading({ hasMoreBefore: false });
      }
    },
    [parseWsMessage, setMessages, setLoading],
  );

  const handleFetchAfterHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const filtered = payload.filter(item => item.message.roomId === roomId);

      const mapped = filtered
        .map(item => parseWsMessage({ item }))
        .filter((m): m is Message => m !== null);

      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        const existing = new Set(reconciledPrev.map(m => m.id));
        const dedup = mapped.filter(m => !existing.has(m.id));
        return [...reconciledPrev, ...dedup];
      });

      setLoading({ isAfterLoading: false });

      if (mapped.length < CHAT_AFTER_SIZE || mapped.length === 0) {
        setLoading({ hasMoreAfter: false });
      }

      if (isReconnectFetchRef.current) {
        isReconnectFetchRef.current = false;
        useChatRoomRuntimeStore.getState().requestScrollToBottom();
      }
    },
    [parseWsMessage, setMessages, setLoading, isReconnectFetchRef],
  );

  const handleTagBroadcast = useCallback(
    (targetMessageId: string, items: TagListType[]) => {
      const normalizedItems = items.map(item => ({
        ...item,
        tagId: Number(item.tagId),
        categoryId: Number(item.categoryId),
      }));

      const seen = new Set<number>();
      const deduplicatedItems = normalizedItems.filter(item => {
        if (seen.has(item.tagId)) return false;
        seen.add(item.tagId);
        return true;
      });

      setMessages(prev =>
        prev.map(m => (m.id === targetMessageId ? { ...m, tags: deduplicatedItems } : m)),
      );
    },
    [setMessages],
  );

  const handleDeleteMessage = useCallback(
    (messageId?: string) => {
      if (!messageId) return;
      deleteMessageById(messageId);
    },
    [deleteMessageById],
  );

  const handleReadMessage = useCallback(
    (readItems: Array<{ roomId: string; messageId: string; userId: string }>, roomId: string) => {
      const roomReadItems = readItems.filter(item => item.roomId === roomId);
      if (roomReadItems.length === 0) return;

      const { messages: currentMessages } = useChatRoomRuntimeStore.getState();
      const messageMap = new Map(currentMessages.map(m => [m.id, m]));
      const readUsersByMessageId = new Map<string, Set<string>>();

      roomReadItems.forEach(item => {
        const normalizedReaderId = normalizeUserId(item.userId);
        if (!normalizedReaderId) return;

        if (!messageMap.has(item.messageId)) {
          addPendingReadEvent(item.messageId, normalizedReaderId);
          return;
        }

        const currentMessage = messageMap.get(item.messageId);
        if (currentMessage?.readUserIds.includes(normalizedReaderId)) return;

        let userSet = readUsersByMessageId.get(item.messageId);
        if (!userSet) {
          userSet = new Set();
          readUsersByMessageId.set(item.messageId, userSet);
        }
        userSet.add(normalizedReaderId);
      });

      if (readUsersByMessageId.size === 0) return;

      const participants = participantsManager.getParticipants(roomId, channelType);
      const hasParticipants = participants.length > 0;
      const participantIds = hasParticipants
        ? readCountCalculator.createParticipantIdSet(participants)
        : new Set<string>();

      setMessages(prev =>
        prev.map(msg => {
          const readers = readUsersByMessageId.get(msg.id);
          if (!readers || readers.size === 0) return msg;

          const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
          readers.forEach(readerId => nextReadUserIds.add(normalizeUserId(readerId)));

          if (!hasParticipants) {
            return { ...msg, readUserIds: Array.from(nextReadUserIds) };
          }

          const validReadUserIds = readCountCalculator.filterValidReaders(
            Array.from(nextReadUserIds),
            participantIds,
          );
          const nextNotReadCount = readCountCalculator.calculateNotReadCount({
            readUserIds: validReadUserIds,
            participants,
          });

          return { ...msg, readUserIds: validReadUserIds, notReadCount: nextNotReadCount };
        }),
      );
    },
    [normalizeUserId, addPendingReadEvent, participantsManager, channelType, setMessages],
  );

  const handleParticipantChange = useCallback(
    (eventType: 'EXIT' | 'INVITE', roomId: string) => {
      participantsManager
        .refetchParticipants(roomId, channelType)
        .then(() => {
          if (!isMountedRef.current) return;
          const participants = participantsManager.getParticipants(roomId, channelType);
          useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
          recalculateAllMessagesNotReadCount(participants);
        })
        .catch(error => {
          console.error(`[WS] SUBMIT_${eventType} refetch 실패:`, error);
        });
    },
    [participantsManager, channelType, recalculateAllMessagesNotReadCount, isMountedRef],
  );

  const handlePublishMessage = useCallback(
    (payload: WebSocketPublishItem, roomId: string) => {
      const m = parseWsMessage({ item: payload });
      if (!m) return;

      const incomingFileId = isMediaFileMessage(payload.message)
        ? (payload.message.payload.fileId ?? undefined)
        : undefined;

      if (incomingFileId) {
        const { messages } = useChatRoomRuntimeStore.getState();
        const hasLocal = messages.some(msg => msg.fileId === incomingFileId && msg.isLocal);
        if (hasLocal) {
          replaceLocalWithServer(incomingFileId, m);
          return;
        }
      }

      setMessages(prev => {
        if (prev.some(msg => msg.id === m.id)) return prev;
        return [...prev, m];
      });

      if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
        handleParticipantChange('EXIT', roomId);
        return;
      }

      if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
        handleParticipantChange('INVITE', roomId);
        return;
      }
    },
    [parseWsMessage, replaceLocalWithServer, setMessages, handleParticipantChange],
  );

  // WebSocket 메시지 라우터
  const handleWsMessage = useCallback(
    (data: WebSocketEnvelope) => {
      const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
      if (!roomId) return;

      if (isViewInMessage(data) || isViewOutMessage(data)) return;

      if (isExitMessageRoomSession(data)) {
        handleExitMessageRoom(roomId);
        return;
      }

      if (isFetchMessage(data) || isFetchBeforeMessage(data)) {
        handleFetchBeforeHistory(data.response.payload, roomId);
        return;
      }

      if (isFetchAfterMessage(data)) {
        handleFetchAfterHistory(data.response.payload, roomId);
        return;
      }

      if (isAddTagSession(data) || isRemoveTagSession(data)) return;

      if (!isBroadcast(data)) return;

      const { channelType: resChannelType } = data.response;
      if (resChannelType !== channelType) return;

      if (isSub(data)) return;

      if (isDeleteMessage(data)) {
        handleDeleteMessage(data.response.payload.message.id);
        return;
      }

      if (isReadMessage(data)) {
        handleReadMessage(data.response.payload.items, roomId);
        return;
      }

      if (isPublish(data)) {
        const payload = data.response.payload;
        if (payload.message.roomId !== roomId) return;
        handlePublishMessage(payload, roomId);
        return;
      }

      if (isExitMessageRoomBroadcast(data)) {
        const payload = data.response.payload;
        const loginUserId = String(useAuthStore.getState().user?.id ?? '');
        if (String(payload.userId) === loginUserId) {
          handleExitMessageRoom(roomId);
        }
      }

      if (isAddTagBroadcast(data)) {
        const payload = data.response.payload;
        const items = payload.items;
        const targetMessageId =
          items[0]?.messageId ??
          ((payload as Record<string, unknown>).messageId as string | undefined);
        if (targetMessageId) handleTagBroadcast(targetMessageId, items);
        return;
      }

      if (isRemoveTagBroadcast(data)) {
        const payload = data.response.payload;
        const items = payload.items;
        const pendingId = useChatRoomRuntimeStore.getState().pendingRemoveTagMessageId;
        const targetMessageId =
          items[0]?.messageId ??
          ((payload as Record<string, unknown>).messageId as string | undefined) ??
          pendingId;
        if (targetMessageId) handleTagBroadcast(targetMessageId, items);
        useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
        return;
      }
    },
    [
      handleExitMessageRoom,
      handleFetchBeforeHistory,
      handleFetchAfterHistory,
      handleTagBroadcast,
      handleDeleteMessage,
      handleReadMessage,
      handlePublishMessage,
      channelType,
    ],
  );

  return { handleWsMessage };
};

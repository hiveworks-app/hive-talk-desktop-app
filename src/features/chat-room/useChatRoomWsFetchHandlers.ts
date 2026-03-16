'use client';

import { useCallback, type MutableRefObject } from 'react';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { applyReconciliation, extractDeletedMessageIds } from '@/features/chat-room/reconcileDeletedMessages';
import { CHAT_BEFORE_SIZE, CHAT_AFTER_SIZE } from '@/shared/config/constants';
import { Message, WebSocketPublishItem, WebSocketChannelTypes } from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

interface FetchHandlersParams {
  channelType: WebSocketChannelTypes;
  parseWsMessage: ReturnType<typeof createWsMessageParser>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  replaceMessages: (next: Message[]) => void;
  setLoading: (loading: Record<string, unknown>) => void;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  addPendingReadEvent: (messageId: string, userId: string) => void;
  participantsManager: ParticipantsManager;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isInitialFetchRef: MutableRefObject<boolean>;
}

export function useChatRoomWsFetchHandlers({
  channelType, parseWsMessage, setMessages, replaceMessages, setLoading,
  normalizeUserId, addPendingReadEvent, participantsManager,
  isReconnectFetchRef, isInitialFetchRef,
}: FetchHandlersParams) {

  const handleFetchBeforeHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const reverse = [...payload].reverse();
      const filtered = reverse.filter(item => item.message.roomId === roomId);
      const mapped = filtered.map(item => parseWsMessage({ item })).filter((m): m is Message => m !== null);

      if (isInitialFetchRef.current) {
        isInitialFetchRef.current = false;
        replaceMessages(mapped);
      } else {
        setMessages(prev => {
          const deletedIds = extractDeletedMessageIds(filtered);
          const reconciledPrev = applyReconciliation(prev, deletedIds);
          const existing = new Set(reconciledPrev.map(m => m.id));
          return [...mapped.filter(m => !existing.has(m.id)), ...reconciledPrev];
        });
      }

      setLoading({ isBeforeLoading: false });
      if (mapped.length < CHAT_BEFORE_SIZE || mapped.length === 0) {
        setLoading({ hasMoreBefore: false });
      }
    },
    [parseWsMessage, setMessages, replaceMessages, setLoading, isInitialFetchRef],
  );

  const handleFetchAfterHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const filtered = payload.filter(item => item.message.roomId === roomId);
      const mapped = filtered.map(item => parseWsMessage({ item })).filter((m): m is Message => m !== null);

      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        const existing = new Set(reconciledPrev.map(m => m.id));
        return [...reconciledPrev, ...mapped.filter(m => !existing.has(m.id))];
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
        if (!userSet) { userSet = new Set(); readUsersByMessageId.set(item.messageId, userSet); }
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

          const validReadUserIds = readCountCalculator.filterValidReaders(Array.from(nextReadUserIds), participantIds);
          const nextNotReadCount = readCountCalculator.calculateNotReadCount({ readUserIds: validReadUserIds, participants });
          return { ...msg, readUserIds: validReadUserIds, notReadCount: nextNotReadCount };
        }),
      );
    },
    [normalizeUserId, addPendingReadEvent, participantsManager, channelType, setMessages],
  );

  return { handleFetchBeforeHistory, handleFetchAfterHistory, handleReadMessage };
}

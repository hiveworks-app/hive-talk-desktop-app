'use client';

import { useCallback } from 'react';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { Message, WebSocketChannelTypes } from '@/shared/types/websocket';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

interface UsePendingReadsParams {
  channelType: WebSocketChannelTypes;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  participantsManager: ParticipantsManager;
}

export function usePendingReads({ channelType, normalizeUserId, participantsManager }: UsePendingReadsParams) {
  const _setMessages = useChatRoomRuntimeStore(s => s.setMessages);
  const removePendingReadEvents = useChatRoomRuntimeStore(s => s.removePendingReadEvents);

  const processPendingReads = useCallback(() => {
    const { pendingReadEvents, currentRoomId: roomId } = useChatRoomRuntimeStore.getState();
    if (pendingReadEvents.size === 0 || !roomId) return;

    const participants = participantsManager.getParticipants(roomId, channelType);
    if (participants.length === 0) return;

    const processedMessageIds: string[] = [];
    let hasChanges = false;
    const participantIds = readCountCalculator.createParticipantIdSet(participants);

    _setMessages(prevMessages => {
      const nextMessages = prevMessages.map(msg => {
        const pendingReaders = pendingReadEvents.get(msg.id);
        if (!pendingReaders || pendingReaders.size === 0) return msg;

        const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
        let hasNewReaders = false;
        pendingReaders.forEach(readerId => {
          const nid = normalizeUserId(readerId);
          if (!nid || nextReadUserIds.has(nid)) return;
          nextReadUserIds.add(nid);
          hasNewReaders = true;
        });

        processedMessageIds.push(msg.id);
        if (!hasNewReaders) return msg;

        const validReadUserIds = readCountCalculator.filterValidReaders(Array.from(nextReadUserIds), participantIds);
        const nextNotReadCount = readCountCalculator.calculateNotReadCount({ readUserIds: validReadUserIds, participants });
        hasChanges = true;
        return { ...msg, readUserIds: validReadUserIds, notReadCount: nextNotReadCount };
      });
      return hasChanges ? nextMessages : prevMessages;
    });

    if (processedMessageIds.length > 0) removePendingReadEvents(processedMessageIds);
  }, [_setMessages, channelType, normalizeUserId, participantsManager, removePendingReadEvents]);

  const setMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => { _setMessages(updater); processPendingReads(); },
    [_setMessages, processPendingReads],
  );

  const recalculateAllMessagesNotReadCount = useCallback(
    (participants: ParticipantItemsType[]) => {
      setMessages(prev =>
        prev.map(msg => {
          const result = readCountCalculator.recalculateForParticipantChange(msg.readUserIds, participants);
          if (result.readUserIds.length === msg.readUserIds.length && result.notReadCount === msg.notReadCount) return msg;
          return { ...msg, readUserIds: result.readUserIds, notReadCount: result.notReadCount };
        }),
      );
    },
    [setMessages],
  );

  return { setMessages, recalculateAllMessagesNotReadCount };
}

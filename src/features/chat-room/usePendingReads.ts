'use client';

import { useCallback } from 'react';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
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

  const processPendingReads = useCallback(() => {
    const { currentRoomId: roomId } = useChatRoomRuntimeStore.getState();
    if (!roomId) return;
    // 전역 PendingRead 레지스트리(RN §7.4) — 방 전환에도 보류가 유지되고 TTL sweep이 상한 관리
    const pendingEntries = pendingReadRegistry.peekRoom(roomId);
    if (pendingEntries.length === 0) return;

    const participants = participantsManager.getParticipants(roomId, channelType);
    if (participants.length === 0) return; // 참여자 로드 후 재시도 (ack하지 않음)

    const pendingByMessageId = new Map(pendingEntries.map(e => [e.messageId, e]));
    const processed: { messageId: string; userIds: string[] }[] = [];
    let hasChanges = false;

    _setMessages(prevMessages => {
      const nextMessages = prevMessages.map(msg => {
        const entry = pendingByMessageId.get(msg.id);
        if (!entry) return msg;
        const readerIds = Array.from(entry.readItemsByUserId.keys());

        const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
        let hasNewReaders = false;
        readerIds.forEach(readerId => {
          const nid = normalizeUserId(readerId);
          if (!nid || nextReadUserIds.has(nid)) return;
          nextReadUserIds.add(nid);
          hasNewReaders = true;
        });

        processed.push({ messageId: msg.id, userIds: readerIds });
        if (!hasNewReaders) return msg;

        // 저장은 원본 보존(읽음 비후퇴 불변식) — 퇴장자 필터는 계산 시점에만 적용
        const readUserIds = Array.from(nextReadUserIds);
        const nextNotReadCount = readCountCalculator.calculateNotReadCount({ readUserIds, participants });
        hasChanges = true;
        return { ...msg, readUserIds, notReadCount: nextNotReadCount };
      });
      return hasChanges ? nextMessages : prevMessages;
    });

    processed.forEach(pr => pendingReadRegistry.acknowledge(roomId, pr.messageId, pr.userIds));
  }, [_setMessages, channelType, normalizeUserId, participantsManager]);

  const setMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => { _setMessages(updater); processPendingReads(); },
    [_setMessages, processPendingReads],
  );

  const recalculateAllMessagesNotReadCount = useCallback(
    (participants: ParticipantItemsType[]) => {
      setMessages(prev =>
        prev.map(msg => {
          // 저장은 원본 보존 — 참여자 변경 시 notReadCount만 재계산, readUserIds는 raw 유지.
          // 필터 결과를 저장하면 참여자 스냅샷이 불완전한 순간의 읽음 기록이 복구 불가로 소실된다.
          const notReadCount = readCountCalculator.calculateNotReadCount({
            readUserIds: msg.readUserIds,
            participants,
          });
          if (notReadCount === msg.notReadCount) return msg;
          return { ...msg, notReadCount };
        }),
      );
    },
    [setMessages],
  );

  return { setMessages, recalculateAllMessagesNotReadCount };
}

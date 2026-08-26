'use client';

import { useCallback } from 'react';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
import { Message, WebSocketChannelTypes } from '@/shared/types/websocket';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

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

    // 참여자 미로드/불완전(기대 인원 미달)이어도 totalUserCount가 있으면 폴백 계산으로 즉시
    // 반영한다 (파서·READ 핸들러와 동일 규칙). 무조건 보류하면 신규 방(사이드패널 미개방 →
    // 참여자 영영 미로드)에서 보류가 소비되지 않아 카운트가 고정된다. 둘 다 없을 때만 재시도.
    const fallbackTotalCount = useChatRoomInfo.getState().totalUserCount ?? 0;
    const participants = participantsManager.getReliableParticipants(roomId, channelType, fallbackTotalCount);
    if (participants.length === 0 && fallbackTotalCount === 0) return;

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
        const nextNotReadCount =
          participants.length > 0
            ? readCountCalculator.calculateNotReadCount({ readUserIds, participants })
            : Math.max(0, fallbackTotalCount - readUserIds.length);
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

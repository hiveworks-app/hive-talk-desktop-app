'use client';

import { useCallback, type MutableRefObject } from 'react';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { mergeFetchedReadState } from '@/features/chat-room/mergeFetchedReadState';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
import { applyReconciliation, extractDeletedMessageIds } from '@/features/chat-room/reconcileDeletedMessages';
import { CHAT_BEFORE_SIZE, CHAT_AFTER_SIZE } from '@/shared/config/constants';
import { Message, WebSocketPublishItem, WebSocketChannelTypes } from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';

interface FetchHandlersParams {
  channelType: WebSocketChannelTypes;
  parseWsMessage: ReturnType<typeof createWsMessageParser>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  replaceMessages: (next: Message[]) => void;
  setLoading: (loading: Record<string, unknown>) => void;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  participantsManager: ParticipantsManager;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isInitialFetchRef: MutableRefObject<boolean>;
}

export function useChatRoomWsFetchHandlers({
  channelType, parseWsMessage, setMessages, replaceMessages, setLoading,
  normalizeUserId, participantsManager,
  isReconnectFetchRef, isInitialFetchRef,
}: FetchHandlersParams) {

  const handleFetchBeforeHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      // ⚠️ 서버가 빈 히스토리를 null로 내려줄 수 있음 → arraySpread null 크래시 방어 (RN useChatRoomController 패리티)
      const reverse = [...(payload ?? [])].reverse();
      // defensive: 서버가 비정상 envelope(message 누락)을 보낼 가능성 차단
      const filtered = reverse.filter(item => item?.message?.roomId === roomId);
      const mapped = filtered.map(item => parseWsMessage({ item })).filter((m): m is Message => m !== null);

      if (isInitialFetchRef.current) {
        isInitialFetchRef.current = false;
        // 실패한 로컬 메시지를 보존하여 재시도/삭제 가능하도록 유지
        const { messages: currentMessages } = useChatRoomRuntimeStore.getState();
        const failedLocal = currentMessages.filter(m => m.isLocal && m.localStatus === 'failed');
        // 방 이탈/앱 재실행으로 유실된 영속 실패 메시지 복원 (RN pending_messages 패리티).
        // 유령 중복 방지: 서버 히스토리에 같은 내용의 정식 메시지가 있으면 복원하지 않는다.
        const inMemoryIds = new Set(failedLocal.map(m => m.id));
        const serverTexts = new Set(mapped.filter(m => m.sender === 'me').map(m => m.text));
        const persistedFailed = (useFailedMessagesStore.getState().byRoom[roomId] ?? []).filter(
          m => !inMemoryIds.has(m.id) && !serverTexts.has(m.text),
        );
        // 서버에 정식 전송된 것으로 확인된 유령 실패 메시지는 영속 목록에서 정리
        (useFailedMessagesStore.getState().byRoom[roomId] ?? [])
          .filter(m => serverTexts.has(m.text))
          .forEach(m => useFailedMessagesStore.getState().removeFailed(roomId, m.id));
        const allFailed = [...failedLocal, ...persistedFailed];
        replaceMessages(allFailed.length > 0 ? [...mapped, ...allFailed] : mapped);
      } else {
        const participants = participantsManager.getParticipants(roomId, channelType);
        setMessages(prev => {
          const deletedIds = extractDeletedMessageIds(filtered);
          const reconciledPrev = applyReconciliation(prev, deletedIds);
          // FETCH 겹침 병합 — 겹치는 기존 메시지에 서버의 신선 읽음/표시/파생문구 반영 (RN 패리티)
          const { merged } = mergeFetchedReadState(reconciledPrev, mapped, participants);
          const existing = new Set(merged.map(m => m.id));
          return [...mapped.filter(m => !existing.has(m.id)), ...merged];
        });
      }

      setLoading({ isBeforeLoading: false });
      if (mapped.length < CHAT_BEFORE_SIZE || mapped.length === 0) {
        setLoading({ hasMoreBefore: false });
      }
    },
    [parseWsMessage, setMessages, replaceMessages, setLoading, isInitialFetchRef, participantsManager, channelType],
  );

  const handleFetchAfterHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      // 빈 히스토리 null 방어 + 비정상 envelope(message 누락) 방어 (RN 패리티)
      const filtered = (payload ?? []).filter(item => item?.message?.roomId === roomId);
      const mapped = filtered.map(item => parseWsMessage({ item })).filter((m): m is Message => m !== null);

      const participants = participantsManager.getParticipants(roomId, channelType);
      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        // FETCH 겹침 병합 — 재연결 AFTER 회수 시 브로드캐스트 유실분 읽음까지 복구 (RN 패리티)
        const { merged } = mergeFetchedReadState(reconciledPrev, mapped, participants);
        const existing = new Set(merged.map(m => m.id));
        return [...merged, ...mapped.filter(m => !existing.has(m.id))];
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
    [parseWsMessage, setMessages, setLoading, isReconnectFetchRef, participantsManager, channelType],
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
          // 메시지 미도착 — 전역 레지스트리에 보류 (방 전환에도 유지, TTL sweep이 상한 관리)
          pendingReadRegistry.add(
            [{ roomId: item.roomId, messageId: item.messageId, userId: normalizedReaderId }],
            Date.now(),
          );
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

      setMessages(prev =>
        prev.map(msg => {
          const readers = readUsersByMessageId.get(msg.id);
          if (!readers || readers.size === 0) return msg;

          const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
          readers.forEach(readerId => nextReadUserIds.add(normalizeUserId(readerId)));

          // 저장은 원본 보존(읽음 비후퇴 불변식) — 퇴장자 필터는 calculateNotReadCount 계산 시점에만
          const readUserIds = Array.from(nextReadUserIds);
          if (!hasParticipants) {
            return { ...msg, readUserIds };
          }

          const nextNotReadCount = readCountCalculator.calculateNotReadCount({ readUserIds, participants });
          return { ...msg, readUserIds, notReadCount: nextNotReadCount };
        }),
      );
    },
    [normalizeUserId, participantsManager, channelType, setMessages],
  );

  return { handleFetchBeforeHistory, handleFetchAfterHistory, handleReadMessage };
}

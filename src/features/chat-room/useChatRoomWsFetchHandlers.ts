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
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
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

      // 진단(2026-08-26 읽음 미갱신 추적) — 서버 읽음 원장 확인용, 원인 확정 후 제거.
      // 여기 read에 모바일 계정 id가 없으면 서버가 읽음을 등록하지 않은 것 (클라이언트 무관)
      console.info(
        '[WS][FETCH] BEFORE 응답 read 원장:',
        mapped.map(m => `${String(m.id).slice(-4)} read=[${m.readUserIds.join(',')}] cnt=${m.notReadCount}`).join(' | '),
      );

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
        // 불완전 참여자 스냅샷(초대 직후 본인만 등)은 빈 배열 취급 → totalUserCount 폴백 (RN 가드 패리티)
        const participants = participantsManager.getReliableParticipants(
          roomId, channelType, useChatRoomInfo.getState().totalUserCount ?? 0,
        );
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

      // 불완전 참여자 스냅샷은 빈 배열 취급 → totalUserCount 폴백 (RN 가드 패리티)
      const participants = participantsManager.getReliableParticipants(
        roomId, channelType, useChatRoomInfo.getState().totalUserCount ?? 0,
      );
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
      // 서버 payload의 id가 숫자로 오는 사례 방어 (PUB 에코 strict === 불일치와 동일 유형) — String 정규화 비교
      const roomReadItems = readItems.filter(item => String(item.roomId) === String(roomId));
      if (roomReadItems.length === 0) {
        if (readItems.length > 0) {
          console.warn('[WS][READ] 방 불일치로 무시:', readItems[0]?.roomId, '!== 현재 방', roomId);
        }
        return;
      }

      const { messages: currentMessages } = useChatRoomRuntimeStore.getState();
      const messageMap = new Map(currentMessages.map(m => [String(m.id), m]));
      const readUsersByMessageId = new Map<string, Set<string>>();

      roomReadItems.forEach(item => {
        const normalizedReaderId = normalizeUserId(item.userId);
        if (!normalizedReaderId) return;

        if (!messageMap.has(String(item.messageId))) {
          console.warn('[WS][READ] 메시지 미도착 — 보류 등록:', item.messageId, 'reader:', item.userId);
          // 메시지 미도착 — 전역 레지스트리에 보류 (방 전환에도 유지, TTL sweep이 상한 관리).
          // 키는 String 정규화 — 서버가 숫자 id를 주면 소비측(문자열 조회)과 영원히 불일치한다 (2026-08-26 리뷰)
          pendingReadRegistry.add(
            [{ roomId: String(item.roomId), messageId: String(item.messageId), userId: normalizedReaderId }],
            Date.now(),
          );
          return;
        }

        const currentMessage = messageMap.get(String(item.messageId));
        if (currentMessage?.readUserIds.includes(normalizedReaderId)) return;

        let userSet = readUsersByMessageId.get(String(item.messageId));
        if (!userSet) { userSet = new Set(); readUsersByMessageId.set(String(item.messageId), userSet); }
        userSet.add(normalizedReaderId);
      });

      if (readUsersByMessageId.size === 0) {
        console.info('[WS][READ] 신규 반영 없음 (이미 처리됨/중복):', roomReadItems.length, '건');
        return;
      }

      // 불완전 참여자 스냅샷(초대 직후 본인만 등)으로 계산하면 안읽음이 조기 소멸한다 —
      // 기대 인원 미달이면 빈 배열 취급해 아래 totalUserCount 폴백을 태운다 (RN 가드 패리티)
      const participants = participantsManager.getReliableParticipants(
        roomId, channelType, useChatRoomInfo.getState().totalUserCount ?? 0,
      );
      const hasParticipants = participants.length > 0;
      // 진단(2026-08-25 읽음 미갱신 추적) — 원인 확정 후 제거 예정
      console.info('[WS][READ] 병합:', { 대상메시지: readUsersByMessageId.size, 참여자수: participants.length, totalUserCount: useChatRoomInfo.getState().totalUserCount });

      setMessages(prev =>
        prev.map(msg => {
          const readers = readUsersByMessageId.get(String(msg.id));
          if (!readers || readers.size === 0) return msg;

          const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
          readers.forEach(readerId => nextReadUserIds.add(normalizeUserId(readerId)));

          // 저장은 원본 보존(읽음 비후퇴 불변식) — 퇴장자 필터는 calculateNotReadCount 계산 시점에만
          const readUserIds = Array.from(nextReadUserIds);
          if (!hasParticipants) {
            // participants 캐시 미로드(신규 초대 직후 등) — 파서와 동일하게 totalUserCount 폴백으로
            // 재계산한다. 폴백 없이 readUserIds만 갱신하면 배지가 초기값에 고정된다(3인 방 2 고정 실측).
            const totalCount = useChatRoomInfo.getState().totalUserCount ?? 0;
            const nextNotReadCount =
              totalCount > 0 ? Math.max(0, totalCount - readUserIds.length) : msg.notReadCount;
            return { ...msg, readUserIds, notReadCount: nextNotReadCount };
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

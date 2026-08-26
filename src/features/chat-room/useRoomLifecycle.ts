'use client';

import { useEffect, type MutableRefObject } from 'react';
import { ParticipantsManager } from '@/features/chat-room/domain';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WebSocketChannelTypes, WebSocketEnvelope, WebSocketPublishItem } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

/* 진입 참여자 재조회 정책 (RN syncEntryParticipants 패리티) — 초대 직후 서버 /participants가
   잠시 불완전한 목록(본인만)을 반환하는 구간이 있고, 그 응답이 staleTime 캐시에 굳으면
   방을 드나들어도 교정되지 않는다 (RN 2026-07-29 실측). */
const ENTRY_PARTICIPANTS_MAX_ATTEMPTS = 3;
const ENTRY_PARTICIPANTS_RETRY_DELAY_MS = 1500;

interface RoomLifecycleDeps {
  currentRoomId: string | null;
  channelType: WebSocketChannelTypes;
  isConnected: boolean;
  send: (msg: unknown) => void;
  addListener: (roomId: string, cb: (data: WebSocketEnvelope) => void) => void;
  removeListener: (roomId: string) => void;
  participantsManager: ParticipantsManager;
  recalculateAllMessagesNotReadCount: (p: ParticipantItemsType[]) => void;
  handleWsMessageRef: MutableRefObject<(data: WebSocketEnvelope) => void>;
  viewStateRef: MutableRefObject<'in' | 'out' | null>;
  isMountedRef: MutableRefObject<boolean>;
  needsFetchAfterReconnectRef: MutableRefObject<boolean>;
  isReconnectFetchRef: MutableRefObject<boolean>;
  lastMessage: WebSocketPublishItem | null;
  builders: {
    buildSubscribeMessage: (opts: { channelIdOverride: string }) => unknown;
    buildViewInMessageRoom: (opts: { channelIdOverride: string }) => unknown;
    buildViewOutMessageRoom: (opts: { channelIdOverride: string }) => unknown;
    buildFetchAfterMessage: (opts: { currentMessage: string; isInclusive: boolean; channelIdOverride: string }) => unknown;
    buildFetchBeforeMessage: (opts: { currentMessage: string; isInclusive: boolean; channelIdOverride: string }) => unknown;
  };
  getLastLocalMessageId: () => string | undefined;
}

export function useRoomLifecycle(deps: RoomLifecycleDeps) {
  const {
    currentRoomId, channelType, isConnected, send, addListener, removeListener,
    participantsManager, recalculateAllMessagesNotReadCount,
    handleWsMessageRef, viewStateRef, isMountedRef, needsFetchAfterReconnectRef,
    isReconnectFetchRef, lastMessage, builders, getLastLocalMessageId,
  } = deps;

  // 1. Room Session 관리
  useEffect(() => {
    if (!currentRoomId) return;
    isMountedRef.current = true;
    // 방 화면 활성 플래그 — 목록 unread 클램프 등 "보고 있는 방" 판정의 근거 (2026-08-26 리뷰)
    useChatRoomRuntimeStore.getState().setRoomViewActive(true);

    send(builders.buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    const { invitedUserIds } = useChatRoomInfo.getState();
    // 재시도 타이머는 방 전환 시 반드시 정리 — isMountedRef는 새 방 effect가 true로 되돌려
    // 가드가 되지 않고, 이전 방의 참여자가 전역 스토어(totalUserCount)를 오염시킨다 (2026-08-26 리뷰)
    let entrySyncTimer: ReturnType<typeof setTimeout> | null = null;
    const isStillThisRoom = () =>
      isMountedRef.current && useChatRoomRuntimeStore.getState().currentRoomId === currentRoomId;
    if (invitedUserIds.length === 0) {
      // 기대 인원(totalUserCount) 미달이면 서버 반영 지연으로 보고 1.5s 간격 재조회 (RN 패리티).
      // 1회차는 캐시 우선(ensure), 2회차부터는 서버 강제 조회(refetch — stale 캐시 교정).
      // 한도 소진 시에는 서버 값을 진실로 받아들여 그대로 적용한다 (실제 인원 감소 가능성).
      const syncEntryParticipants = (attemptNo: number) => {
        const fetched =
          attemptNo === 0
            ? participantsManager.ensureParticipants(currentRoomId, channelType)
            : participantsManager
                .refetchParticipants(currentRoomId, channelType)
                .then(() => participantsManager.getParticipants(currentRoomId, channelType));
        fetched.then(participants => {
          if (!isStillThisRoom()) return;
          const expected = useChatRoomInfo.getState().totalUserCount ?? 0;
          const isShortOfExpected = expected > 0 && participants.length < expected;
          if (isShortOfExpected && attemptNo + 1 < ENTRY_PARTICIPANTS_MAX_ATTEMPTS) {
            console.warn(`[WS] 참여자 조회 부족 (기대 ${expected}명 / 조회 ${participants.length}명) → 재조회 ${attemptNo + 1}/${ENTRY_PARTICIPANTS_MAX_ATTEMPTS - 1}`);
            entrySyncTimer = setTimeout(() => {
              entrySyncTimer = null;
              if (isStillThisRoom()) syncEntryParticipants(attemptNo + 1);
            }, ENTRY_PARTICIPANTS_RETRY_DELAY_MS);
            return;
          }
          if (participants.length > 0) {
            useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
          }
          recalculateAllMessagesNotReadCount(participants);
        }).catch(err => { console.warn('[WS] 참여자 목록 조회 실패:', err); });
      };
      syncEntryParticipants(0);
    }

    return () => {
      isMountedRef.current = false;
      useChatRoomRuntimeStore.getState().setRoomViewActive(false);
      if (entrySyncTimer) clearTimeout(entrySyncTimer);
      if (viewStateRef.current !== 'out') {
        send(builders.buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
        viewStateRef.current = 'out';
      }
      removeListener(currentRoomId);
      // 보류 READ는 전역 레지스트리가 유지 — 방 전환으로 비우지 않는다 (TTL sweep이 상한 관리, RN §7.4)
    };
  }, [currentRoomId]);

  // 2. 창 포커스/블러 + visibilitychange (AppState 대체)
  useEffect(() => {
    if (!currentRoomId) return;

    const handleViewIn = () => {
      if (!isMountedRef.current || viewStateRef.current === 'in') return;
      send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
      viewStateRef.current = 'in';
      needsFetchAfterReconnectRef.current = true;
      // 읽음 catch-up — 서버는 VIEW_OUT 소켓에 READ를 브로드캐스트하지 않는다(2026-08-26 실측:
      // 블러 중 타인 읽음이 프레임 자체가 미수신). RN은 AppState 복귀마다 catch-up fetch를 태우지만
      // (소켓 생존 REUSE 경로 포함), 데스크톱은 재연결 effect에서만 fetch가 돌아 블러 중 발생한
      // 타인 읽음이 영구 미반영됐다. 마지막 메시지 앵커의 BEFORE(inclusive) 재조회로 기존 메시지의
      // 읽음/삭제를 mergeFetchedReadState 병합으로 복구한다 (PUB은 블러 중에도 수신되므로 신규
      // 메시지 회수는 불필요, 소켓이 죽은 경우는 재연결 effect가 담당).
      // 앵커는 서버 메시지만 — 로컬(전송중/실패) id는 서버가 모른다
      const { messages } = useChatRoomRuntimeStore.getState();
      const anchorId = [...messages].reverse().find(m => !m.isLocal)?.id ?? lastMessage?.message?.id;
      // 진단(2026-08-26 읽음 미갱신 추적) — 포커스 복귀 catch-up 발화 확인용, 원인 확정 후 제거
      console.info('[WS][VIEW] IN(포커스 복귀) — catch-up fetch 앵커:', anchorId ?? '(없음)');
      if (anchorId) {
        send(builders.buildFetchBeforeMessage({ currentMessage: anchorId, isInclusive: true, channelIdOverride: currentRoomId }));
      }
    };

    const handleViewOut = () => {
      if (!isMountedRef.current || viewStateRef.current === 'out') return;
      // 진단(2026-08-26 읽음 미갱신 추적) — 원인 확정 후 제거
      console.info('[WS][VIEW] OUT(포커스 이탈)');
      send(builders.buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
      viewStateRef.current = 'out';
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleViewIn();
      else handleViewOut();
    };

    const handleFocus = () => handleViewIn();
    const handleBlur = () => handleViewOut();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [currentRoomId]);

  // 3. WebSocket 재연결 시 리스너 재등록 및 메시지 fetch
  useEffect(() => {
    if (!isConnected || !currentRoomId || !isMountedRef.current) return;

    send(builders.buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    // 참여자는 재연결로 바뀌지 않으므로 재조회하지 않음 (RN useChatRoomController 재연결 effect 패리티).
    // 입장 시(effect#1) 조회 + WS 초대/퇴장 이벤트(handleParticipantChange)로 갱신됨.
    // 과거엔 여기서 ensureParticipants를 호출해, 멤버 아닌 방(나감/강퇴/폭파)일 때
    // 서버가 "해당 그룹 채팅에 멤버가 아닙니다"로 거부 → 불필요한 재연결마다 경고가 떴음.

    if (needsFetchAfterReconnectRef.current) {
      needsFetchAfterReconnectRef.current = false;
      isReconnectFetchRef.current = true;
      const lastLocalId = getLastLocalMessageId();
      if (lastLocalId) {
        send(builders.buildFetchAfterMessage({ currentMessage: lastLocalId, isInclusive: false, channelIdOverride: currentRoomId }));
      } else if (lastMessage?.message?.id) {
        send(builders.buildFetchBeforeMessage({ currentMessage: lastMessage.message.id, isInclusive: true, channelIdOverride: currentRoomId }));
      }
    }
  }, [isConnected, currentRoomId]);
}

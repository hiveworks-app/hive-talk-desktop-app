'use client';

import { useEffect, type MutableRefObject } from 'react';
import { ParticipantsManager } from '@/features/chat-room/domain';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WebSocketChannelTypes, WebSocketEnvelope, WebSocketPublishItem } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

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

    send(builders.buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    const { invitedUserIds } = useChatRoomInfo.getState();
    if (invitedUserIds.length === 0) {
      participantsManager.ensureParticipants(currentRoomId, channelType).then(participants => {
        if (!isMountedRef.current) return;
        if (participants.length > 0) {
          useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
        }
        recalculateAllMessagesNotReadCount(participants);
      }).catch(err => { console.warn('[WS] 참여자 목록 조회 실패:', err); });
    }

    return () => {
      isMountedRef.current = false;
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
    };

    const handleViewOut = () => {
      if (!isMountedRef.current || viewStateRef.current === 'out') return;
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

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
  clearPendingReadEvents: () => void;
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
    clearPendingReadEvents, participantsManager, recalculateAllMessagesNotReadCount,
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
      clearPendingReadEvents();
    };
  }, [currentRoomId]);

  // 2. visibilitychange (AppState 대체)
  useEffect(() => {
    if (!currentRoomId) return;
    const handleVisibility = () => {
      if (!isMountedRef.current) return;
      if (document.visibilityState === 'visible') {
        if (viewStateRef.current !== 'in') {
          send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
          viewStateRef.current = 'in';
        }
        needsFetchAfterReconnectRef.current = true;
      } else if (viewStateRef.current !== 'out') {
        send(builders.buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
        viewStateRef.current = 'out';
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentRoomId]);

  // 3. WebSocket 재연결 시 리스너 재등록 및 메시지 fetch
  useEffect(() => {
    if (!isConnected || !currentRoomId || !isMountedRef.current) return;

    send(builders.buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(builders.buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    participantsManager.ensureParticipants(currentRoomId, channelType).then(participants => {
      if (!isMountedRef.current) return;
      if (participants.length > 0) recalculateAllMessagesNotReadCount(participants);
    }).catch(err => { console.warn('[WS] 재연결 참여자 목록 조회 실패:', err); });

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

'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { useChatRoomWsHandlers } from '@/features/chat-room/useChatRoomWsHandlers';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import {
  Message,
  WebSocketEnvelope,
} from '@/shared/types/websocket';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

export const useChatRoomController = () => {
  const queryClient = useQueryClient();
  const { roomId: saveRoomId, channelType, lastMessage } = useChatRoomInfo();
  const { send, addListener, removeListener, isConnected } = useAppWebSocket();
  const currentRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const setRunTimeRoomId = useChatRoomRuntimeStore(s => s.setRoomId);
  const _setMessages = useChatRoomRuntimeStore(s => s.setMessages);
  const replaceMessages = useChatRoomRuntimeStore(s => s.replaceMessages);
  const deleteMessageById = useChatRoomRuntimeStore(s => s.deleteMessageById);
  const setLoading = useChatRoomRuntimeStore(s => s.setLoading);
  const replaceLocalWithServer = useChatRoomRuntimeStore(s => s.replaceLocalWithServer);
  const addPendingReadEvent = useChatRoomRuntimeStore(s => s.addPendingReadEvent);
  const removePendingReadEvents = useChatRoomRuntimeStore(s => s.removePendingReadEvents);
  const clearPendingReadEvents = useChatRoomRuntimeStore(s => s.clearPendingReadEvents);

  const viewStateRef = useRef<'in' | 'out' | null>(null);
  const isMountedRef = useRef(true);
  const isFirstMountRef = useRef(true);
  const didInitialSyncRef = useRef(false);
  const needsFetchAfterReconnectRef = useRef(false);
  const isReconnectFetchRef = useRef(false);
  const handleWsMessageRef = useRef<(data: WebSocketEnvelope) => void>(() => {});

  const {
    buildSubscribeMessage,
    buildViewInMessageRoom,
    buildViewOutMessageRoom,
    buildFetchBeforeMessage,
    buildFetchAfterMessage,
  } = useWebSocketMessageBuilder({ type: channelType, channelId: currentRoomId });

  const participantsManager = useMemo(() => new ParticipantsManager(queryClient), [queryClient]);

  const normalizeUserId = useCallback((userId: string | number | null | undefined) => {
    return readCountCalculator.normalizeUserId(userId);
  }, []);

  // 읽음 처리 보류 이벤트 처리
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
          const normalizedReaderId = normalizeUserId(readerId);
          if (!normalizedReaderId) return;
          if (nextReadUserIds.has(normalizedReaderId)) return;
          nextReadUserIds.add(normalizedReaderId);
          hasNewReaders = true;
        });

        processedMessageIds.push(msg.id);
        if (!hasNewReaders) return msg;

        const validReadUserIds = readCountCalculator.filterValidReaders(
          Array.from(nextReadUserIds),
          participantIds,
        );
        const nextNotReadCount = readCountCalculator.calculateNotReadCount({
          readUserIds: validReadUserIds,
          participants,
        });

        hasChanges = true;
        return { ...msg, readUserIds: validReadUserIds, notReadCount: nextNotReadCount };
      });

      return hasChanges ? nextMessages : prevMessages;
    });

    if (processedMessageIds.length > 0) {
      removePendingReadEvents(processedMessageIds);
    }
  }, [_setMessages, channelType, normalizeUserId, participantsManager, removePendingReadEvents]);

  const setMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      _setMessages(updater);
      processPendingReads();
    },
    [_setMessages, processPendingReads],
  );

  // WS → UI 메시지 변환
  const parseWsMessageRef = useRef(
    createWsMessageParser({
      getLoginUserId: () => useAuthStore.getState().user?.id,
      getParticipants: () => {
        const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
        const currentChannelType = useChatRoomInfo.getState().channelType;
        if (!roomId) return [];
        const participants = queryClient.getQueryData<ParticipantItemsType[]>(
          ROOM_PARTICIPANTS_KEY(roomId, currentChannelType),
        );
        return participants ?? [];
      },
      getTotalUserCount: () => useChatRoomInfo.getState().totalUserCount,
      consumeNextMyTags: useChatRoomRuntimeStore.getState().consumeNextMyTags,
    }),
  );
  const parseWsMessage = parseWsMessageRef.current;

  // 참여자 변경 시 notReadCount 재계산
  const recalculateAllMessagesNotReadCount = useCallback(
    (participants: ParticipantItemsType[]) => {
      setMessages(prev =>
        prev.map(msg => {
          const result = readCountCalculator.recalculateForParticipantChange(
            msg.readUserIds,
            participants,
          );
          if (
            result.readUserIds.length === msg.readUserIds.length &&
            result.notReadCount === msg.notReadCount
          ) {
            return msg;
          }
          return { ...msg, readUserIds: result.readUserIds, notReadCount: result.notReadCount };
        }),
      );
    },
    [setMessages],
  );

  // WS 핸들러 (분리된 훅)
  const { handleWsMessage } = useChatRoomWsHandlers({
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
  });

  handleWsMessageRef.current = handleWsMessage;

  // 1. Room Session 관리
  useEffect(() => {
    if (!currentRoomId) return;

    isMountedRef.current = true;

    send(buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    const { invitedUserIds } = useChatRoomInfo.getState();
    if (invitedUserIds.length === 0) {
      participantsManager
        .ensureParticipants(currentRoomId, channelType)
        .then(participants => {
          if (!isMountedRef.current) return;
          if (participants.length > 0) {
            useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
          }
          recalculateAllMessagesNotReadCount(participants);
        })
        .catch(error => {
          console.warn('[WS] 참여자 목록 조회 실패:', error);
        });
    }

    return () => {
      isMountedRef.current = false;
      if (viewStateRef.current !== 'out') {
        send(buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
        viewStateRef.current = 'out';
      }
      removeListener(currentRoomId);
      clearPendingReadEvents();
    };
  }, [currentRoomId]);

  // 2. 방 변경 감지 및 초기화
  useEffect(() => {
    if (!saveRoomId) return;

    if (isFirstMountRef.current || currentRoomId !== saveRoomId) {
      isFirstMountRef.current = false;
      replaceMessages([]);
      didInitialSyncRef.current = false;
      setRunTimeRoomId(saveRoomId);
    }
  }, [saveRoomId, currentRoomId]);

  // 3. 초기 메시지 fetch
  useEffect(() => {
    if (!currentRoomId) return;
    if (didInitialSyncRef.current) return;

    const { messages } = useChatRoomRuntimeStore.getState();
    const anchorId = messages[messages.length - 1]?.id ?? lastMessage?.message?.id;

    if (!anchorId) return;

    replaceMessages([]);
    setLoading({ hasMoreBefore: true, hasMoreAfter: true });

    send(
      buildFetchBeforeMessage({
        currentMessage: anchorId,
        isInclusive: true,
        channelIdOverride: currentRoomId,
      }),
    );

    didInitialSyncRef.current = true;

    return () => {
      didInitialSyncRef.current = false;
    };
  }, [currentRoomId, lastMessage?.message?.id]);

  // 4. visibilitychange (AppState 대체)
  useEffect(() => {
    if (!currentRoomId) return;

    const handleVisibility = () => {
      if (!isMountedRef.current) return;

      if (document.visibilityState === 'visible') {
        if (viewStateRef.current !== 'in') {
          send(buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
          viewStateRef.current = 'in';
        }
        needsFetchAfterReconnectRef.current = true;
      } else {
        if (viewStateRef.current !== 'out') {
          send(buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
          viewStateRef.current = 'out';
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentRoomId]);

  // 5. WebSocket 재연결 시 리스너 재등록 및 메시지 fetch
  useEffect(() => {
    if (!isConnected || !currentRoomId) return;
    if (!isMountedRef.current) return;

    send(buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

    // 재연결 시 participants 캐시 갱신 (만료됐을 수 있음)
    participantsManager
      .ensureParticipants(currentRoomId, channelType)
      .then(participants => {
        if (!isMountedRef.current) return;
        if (participants.length > 0) {
          recalculateAllMessagesNotReadCount(participants);
        }
      })
      .catch(error => {
        console.warn('[WS] 재연결 참여자 목록 조회 실패:', error);
      });

    if (needsFetchAfterReconnectRef.current) {
      needsFetchAfterReconnectRef.current = false;
      isReconnectFetchRef.current = true;

      const { messages } = useChatRoomRuntimeStore.getState();
      const lastLocalId = messages[messages.length - 1]?.id;

      if (lastLocalId) {
        send(
          buildFetchAfterMessage({
            currentMessage: lastLocalId,
            isInclusive: false,
            channelIdOverride: currentRoomId,
          }),
        );
      } else if (lastMessage?.message?.id) {
        send(
          buildFetchBeforeMessage({
            currentMessage: lastMessage.message.id,
            isInclusive: true,
            channelIdOverride: currentRoomId,
          }),
        );
      }
    }
  }, [isConnected, currentRoomId]);
};

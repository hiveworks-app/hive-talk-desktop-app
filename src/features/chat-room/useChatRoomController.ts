'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import { usePendingReads } from '@/features/chat-room/usePendingReads';
import { useRoomLifecycle } from '@/features/chat-room/useRoomLifecycle';
import { useChatRoomWsHandlers } from '@/features/chat-room/useChatRoomWsHandlers';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WebSocketEnvelope } from '@/shared/types/websocket';
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
  const replaceMessages = useChatRoomRuntimeStore(s => s.replaceMessages);
  const deleteMessageById = useChatRoomRuntimeStore(s => s.deleteMessageById);
  const setLoading = useChatRoomRuntimeStore(s => s.setLoading);
  const replaceLocalWithServer = useChatRoomRuntimeStore(s => s.replaceLocalWithServer);
  const addPendingReadEvent = useChatRoomRuntimeStore(s => s.addPendingReadEvent);
  const clearPendingReadEvents = useChatRoomRuntimeStore(s => s.clearPendingReadEvents);
  const saveRoomMessages = useChatRoomRuntimeStore(s => s.saveRoomMessages);
  const restoreRoomMessages = useChatRoomRuntimeStore(s => s.restoreRoomMessages);

  const viewStateRef = useRef<'in' | 'out' | null>(null);
  const isMountedRef = useRef(true);
  const isFirstMountRef = useRef(true);
  const didInitialSyncRef = useRef(false);
  const needsFetchAfterReconnectRef = useRef(false);
  const isReconnectFetchRef = useRef(false);
  const isInitialFetchRef = useRef(false);
  const handleWsMessageRef = useRef<(data: WebSocketEnvelope) => void>(() => {});

  const builders = useWebSocketMessageBuilder({ type: channelType, channelId: currentRoomId });
  const participantsManager = useMemo(() => new ParticipantsManager(queryClient), [queryClient]);
  const normalizeUserId = useCallback((userId: string | number | null | undefined) => readCountCalculator.normalizeUserId(userId), []);

  const { setMessages, recalculateAllMessagesNotReadCount } = usePendingReads({
    channelType, normalizeUserId, participantsManager,
  });

  const parseWsMessageRef = useRef(
    createWsMessageParser({
      getLoginUserId: () => useAuthStore.getState().user?.id,
      getParticipants: () => {
        const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
        const ct = useChatRoomInfo.getState().channelType;
        if (!roomId) return [];
        return queryClient.getQueryData<ParticipantItemsType[]>(ROOM_PARTICIPANTS_KEY(roomId, ct)) ?? [];
      },
      getTotalUserCount: () => useChatRoomInfo.getState().totalUserCount,
      consumeNextMyTags: useChatRoomRuntimeStore.getState().consumeNextMyTags,
    }),
  );

  const { handleWsMessage } = useChatRoomWsHandlers({
    channelType, parseWsMessage: parseWsMessageRef.current,
    setMessages, replaceMessages, setLoading, deleteMessageById, replaceLocalWithServer,
    normalizeUserId, addPendingReadEvent, participantsManager,
    recalculateAllMessagesNotReadCount, isReconnectFetchRef, isInitialFetchRef, isMountedRef,
  });
  handleWsMessageRef.current = handleWsMessage;

  useRoomLifecycle({
    currentRoomId, channelType, isConnected, send, addListener, removeListener,
    clearPendingReadEvents, participantsManager, recalculateAllMessagesNotReadCount,
    handleWsMessageRef, viewStateRef, isMountedRef, needsFetchAfterReconnectRef,
    isReconnectFetchRef, lastMessage, builders,
    getLastLocalMessageId: () => {
      const { messages } = useChatRoomRuntimeStore.getState();
      return messages[messages.length - 1]?.id;
    },
  });

  // 방 변경 감지 및 초기화 (캐시 저장/복원)
  useEffect(() => {
    if (!saveRoomId) return;
    if (isFirstMountRef.current || currentRoomId !== saveRoomId) {
      isFirstMountRef.current = false;
      if (currentRoomId) saveRoomMessages(currentRoomId);
      restoreRoomMessages(saveRoomId);
      didInitialSyncRef.current = false;
      setRunTimeRoomId(saveRoomId);
    }
  }, [saveRoomId, currentRoomId]);

  // 초기 메시지 fetch
  useEffect(() => {
    if (!currentRoomId || didInitialSyncRef.current) return;
    const { messages } = useChatRoomRuntimeStore.getState();
    const anchorId = lastMessage?.message?.id ?? messages[messages.length - 1]?.id;
    if (!anchorId) return;

    isInitialFetchRef.current = true;
    setLoading({ hasMoreBefore: true, hasMoreAfter: true });
    send(builders.buildFetchBeforeMessage({ currentMessage: anchorId, isInclusive: true, channelIdOverride: currentRoomId }));
    didInitialSyncRef.current = true;

    return () => { didInitialSyncRef.current = false; };
  }, [currentRoomId, lastMessage?.message?.id]);
};

'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { ParticipantsManager, readCountCalculator } from '@/features/chat-room/domain';
import {
  applyReconciliation,
  extractDeletedMessageIds,
} from '@/features/chat-room/reconcileDeletedMessages';
import {
  CHAT_AFTER_SIZE,
  CHAT_BEFORE_SIZE,
} from '@/shared/config/constants';
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
  ROOM_PARTICIPANTS_KEY,
} from '@/shared/config/queryKeys';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { TagListType } from '@/shared/types/tag';
import {
  Message,
  WS_CHANNEL_TYPE,
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketChannelTypes,
  WebSocketEnvelope,
  WebSocketPublishItem,
  isAddTagBroadcast,
  isAddTagSession,
  isBroadcast,
  isDeleteMessage,
  isExitMessageRoomBroadcast,
  isExitMessageRoomSession,
  isFetchAfterMessage,
  isFetchBeforeMessage,
  isFetchMessage,
  isMediaFileMessage,
  isPublish,
  isReadMessage,
  isRemoveTagBroadcast,
  isRemoveTagSession,
  isSub,
  isViewInMessage,
  isViewOutMessage,
} from '@/shared/types/websocket';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

export const useChatRoomController = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
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

  // ═════════════════════════════════════════════
  // WebSocket 메시지 핸들러
  // ═════════════════════════════════════════════

  const handleExitMessageRoom = useCallback(
    (roomId: string) => {
      const roomListKey =
        channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? GM_ROOM_LIST_KEY : DM_ROOM_LIST_KEY;

      queryClient.setQueryData<GetChatRoomListItemType[]>(roomListKey, oldData => {
        if (!oldData) return [];
        return oldData.filter(item => item.roomModel.roomId !== roomId);
      });

      router.push('/chat');
    },
    [channelType, queryClient, router],
  );

  const handleFetchBeforeHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const reverse = [...payload].reverse();
      const filtered = reverse.filter(item => item.message.roomId === roomId);

      const mapped = filtered
        .map(item => parseWsMessage({ item }))
        .filter((m): m is Message => m !== null);

      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        const existing = new Set(reconciledPrev.map(m => m.id));
        const dedup = mapped.filter(m => !existing.has(m.id));
        return [...dedup, ...reconciledPrev];
      });

      setLoading({ isBeforeLoading: false });

      if (mapped.length < CHAT_BEFORE_SIZE || mapped.length === 0) {
        setLoading({ hasMoreBefore: false });
      }
    },
    [parseWsMessage, setMessages, setLoading],
  );

  const handleFetchAfterHistory = useCallback(
    (payload: WebSocketPublishItem[], roomId: string) => {
      const filtered = payload.filter(item => item.message.roomId === roomId);

      const mapped = filtered
        .map(item => parseWsMessage({ item }))
        .filter((m): m is Message => m !== null);

      setMessages(prev => {
        const deletedIds = extractDeletedMessageIds(filtered);
        const reconciledPrev = applyReconciliation(prev, deletedIds);
        const existing = new Set(reconciledPrev.map(m => m.id));
        const dedup = mapped.filter(m => !existing.has(m.id));
        return [...reconciledPrev, ...dedup];
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
    [parseWsMessage, setMessages, setLoading],
  );

  const handleTagBroadcast = useCallback(
    (targetMessageId: string, items: TagListType[]) => {
      const normalizedItems = items.map(item => ({
        ...item,
        tagId: Number(item.tagId),
        categoryId: Number(item.categoryId),
      }));

      const seen = new Set<number>();
      const deduplicatedItems = normalizedItems.filter(item => {
        if (seen.has(item.tagId)) return false;
        seen.add(item.tagId);
        return true;
      });

      setMessages(prev =>
        prev.map(m => (m.id === targetMessageId ? { ...m, tags: deduplicatedItems } : m)),
      );
    },
    [setMessages],
  );

  const handleDeleteMessage = useCallback(
    (messageId?: string) => {
      if (!messageId) return;
      deleteMessageById(messageId);
    },
    [deleteMessageById],
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
          addPendingReadEvent(item.messageId, normalizedReaderId);
          return;
        }

        const currentMessage = messageMap.get(item.messageId);
        if (currentMessage?.readUserIds.includes(normalizedReaderId)) return;

        let userSet = readUsersByMessageId.get(item.messageId);
        if (!userSet) {
          userSet = new Set();
          readUsersByMessageId.set(item.messageId, userSet);
        }
        userSet.add(normalizedReaderId);
      });

      if (readUsersByMessageId.size === 0) return;

      const participants = participantsManager.getParticipants(roomId, channelType);
      const hasParticipants = participants.length > 0;
      const participantIds = hasParticipants
        ? readCountCalculator.createParticipantIdSet(participants)
        : new Set<string>();

      setMessages(prev =>
        prev.map(msg => {
          const readers = readUsersByMessageId.get(msg.id);
          if (!readers || readers.size === 0) return msg;

          const nextReadUserIds = new Set(msg.readUserIds.map(id => normalizeUserId(id)));
          readers.forEach(readerId => nextReadUserIds.add(normalizeUserId(readerId)));

          if (!hasParticipants) {
            return { ...msg, readUserIds: Array.from(nextReadUserIds) };
          }

          const validReadUserIds = readCountCalculator.filterValidReaders(
            Array.from(nextReadUserIds),
            participantIds,
          );
          const nextNotReadCount = readCountCalculator.calculateNotReadCount({
            readUserIds: validReadUserIds,
            participants,
          });

          return { ...msg, readUserIds: validReadUserIds, notReadCount: nextNotReadCount };
        }),
      );
    },
    [normalizeUserId, addPendingReadEvent, participantsManager, channelType, setMessages],
  );

  const handleParticipantChange = useCallback(
    (eventType: 'EXIT' | 'INVITE', roomId: string) => {
      participantsManager
        .refetchParticipants(roomId, channelType)
        .then(() => {
          if (!isMountedRef.current) return;
          const participants = participantsManager.getParticipants(roomId, channelType);
          useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
          recalculateAllMessagesNotReadCount(participants);
        })
        .catch(error => {
          console.error(`[WS] SUBMIT_${eventType} refetch 실패:`, error);
        });
    },
    [participantsManager, channelType, recalculateAllMessagesNotReadCount],
  );

  const handlePublishMessage = useCallback(
    (payload: WebSocketPublishItem, roomId: string) => {
      const m = parseWsMessage({ item: payload });
      if (!m) return;

      // 로컬 메시지 교체 (파일 업로드 완료 시)
      const incomingFileId = isMediaFileMessage(payload.message)
        ? (payload.message.payload.fileId ?? undefined)
        : undefined;

      if (incomingFileId) {
        const { messages } = useChatRoomRuntimeStore.getState();
        const hasLocal = messages.some(msg => msg.fileId === incomingFileId && msg.isLocal);
        if (hasLocal) {
          replaceLocalWithServer(incomingFileId, m);
          return;
        }
      }

      setMessages(prev => {
        if (prev.some(msg => msg.id === m.id)) return prev;
        return [...prev, m];
      });

      if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
        handleParticipantChange('EXIT', roomId);
        return;
      }

      if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
        handleParticipantChange('INVITE', roomId);
        return;
      }
    },
    [parseWsMessage, replaceLocalWithServer, setMessages, handleParticipantChange],
  );

  // WebSocket 메시지 라우터
  const handleWsMessage = useCallback(
    (data: WebSocketEnvelope) => {
      const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
      if (!roomId) return;

      // SESSION 타입
      if (isViewInMessage(data) || isViewOutMessage(data)) return;

      if (isExitMessageRoomSession(data)) {
        handleExitMessageRoom(roomId);
        return;
      }

      if (isFetchMessage(data) || isFetchBeforeMessage(data)) {
        handleFetchBeforeHistory(data.response.payload, roomId);
        return;
      }

      if (isFetchAfterMessage(data)) {
        handleFetchAfterHistory(data.response.payload, roomId);
        return;
      }

      if (isAddTagSession(data) || isRemoveTagSession(data)) return;

      // BROADCAST 타입
      if (!isBroadcast(data)) return;

      const { channelType: resChannelType } = data.response;
      if (resChannelType !== channelType) return;

      if (isSub(data)) return;

      if (isDeleteMessage(data)) {
        handleDeleteMessage(data.response.payload.message.id);
        return;
      }

      if (isReadMessage(data)) {
        handleReadMessage(data.response.payload.items, roomId);
        return;
      }

      if (isPublish(data)) {
        const payload = data.response.payload;
        if (payload.message.roomId !== roomId) return;
        handlePublishMessage(payload, roomId);
        return;
      }

      if (isExitMessageRoomBroadcast(data)) {
        const payload = data.response.payload;
        const loginUserId = String(useAuthStore.getState().user?.id ?? '');
        if (String(payload.userId) === loginUserId) {
          handleExitMessageRoom(roomId);
        }
      }

      if (isAddTagBroadcast(data)) {
        const payload = data.response.payload;
        const items = payload.items;
        const targetMessageId =
          items[0]?.messageId ??
          ((payload as Record<string, unknown>).messageId as string | undefined);
        if (targetMessageId) handleTagBroadcast(targetMessageId, items);
        return;
      }

      if (isRemoveTagBroadcast(data)) {
        const payload = data.response.payload;
        const items = payload.items;
        const pendingId = useChatRoomRuntimeStore.getState().pendingRemoveTagMessageId;
        const targetMessageId =
          items[0]?.messageId ??
          ((payload as Record<string, unknown>).messageId as string | undefined) ??
          pendingId;
        if (targetMessageId) handleTagBroadcast(targetMessageId, items);
        useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
        return;
      }
    },
    [
      handleExitMessageRoom,
      handleFetchBeforeHistory,
      handleFetchAfterHistory,
      handleTagBroadcast,
      handleDeleteMessage,
      handleReadMessage,
      handlePublishMessage,
      channelType,
    ],
  );

  handleWsMessageRef.current = handleWsMessage;

  // 1. Room Session 관리
  useEffect(() => {
    if (!currentRoomId) return;

    isMountedRef.current = true;

    // 새로 생성된 방은 WS 서버에 구독 등록이 안 되어 있으므로 SUB 전송
    // (기존 방은 이미 구독 중이라 idempotent하게 무시됨)
    send(buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

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
        console.error('[WS] 채팅방 진입 시 참여자 목록 조회 실패:', error);
      });

    return () => {
      isMountedRef.current = false;
      if (viewStateRef.current !== 'out') {
        send(buildViewOutMessageRoom({ channelIdOverride: currentRoomId }));
        viewStateRef.current = 'out';
      }
      removeListener(currentRoomId);
      clearPendingReadEvents();
    };
  }, [currentRoomId, removeListener, clearPendingReadEvents]);

  // 2. 방 변경 감지 및 초기화
  useEffect(() => {
    if (!saveRoomId) return;

    if (currentRoomId !== saveRoomId) {
      if (currentRoomId !== null) {
        replaceMessages([]);
      }
      didInitialSyncRef.current = false;
      setRunTimeRoomId(saveRoomId);
    }
  }, [saveRoomId, currentRoomId, replaceMessages, setRunTimeRoomId]);

  // 3. 초기 메시지 fetch
  useEffect(() => {
    if (!currentRoomId) return;
    if (didInitialSyncRef.current) return;

    const { messages } = useChatRoomRuntimeStore.getState();
    if (messages.length > 0) {
      const lastLocalId = messages[messages.length - 1]?.id;
      const firstLocalId = messages[0]?.id;

      if (lastLocalId) {
        send(
          buildFetchAfterMessage({
            currentMessage: lastLocalId,
            isInclusive: false,
            channelIdOverride: currentRoomId,
          }),
        );
        send(
          buildFetchBeforeMessage({
            currentMessage: lastLocalId,
            isInclusive: true,
            channelIdOverride: currentRoomId,
          }),
        );
      }

      if (firstLocalId) {
        send(
          buildFetchBeforeMessage({
            currentMessage: firstLocalId,
            isInclusive: false,
            channelIdOverride: currentRoomId,
          }),
        );
      }
    } else if (lastMessage?.message?.id) {
      send(
        buildFetchBeforeMessage({
          currentMessage: lastMessage.message.id,
          isInclusive: true,
          channelIdOverride: currentRoomId,
        }),
      );
    } else {
      return;
    }

    didInitialSyncRef.current = true;

    return () => {
      didInitialSyncRef.current = false;
    };
  }, [currentRoomId, lastMessage?.message?.id, buildFetchAfterMessage, buildFetchBeforeMessage]);

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
  }, [currentRoomId, buildViewInMessageRoom, buildViewOutMessageRoom, send]);

  // 5. WebSocket 재연결 시 리스너 재등록 및 메시지 fetch
  useEffect(() => {
    if (!isConnected || !currentRoomId) return;
    if (!isMountedRef.current) return;

    send(buildSubscribeMessage({ channelIdOverride: currentRoomId }));
    addListener(currentRoomId, (data: WebSocketEnvelope) => handleWsMessageRef.current(data));
    send(buildViewInMessageRoom({ channelIdOverride: currentRoomId }));
    viewStateRef.current = 'in';

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
  }, [
    isConnected,
    currentRoomId,
    lastMessage?.message?.id,
    buildFetchAfterMessage,
    buildFetchBeforeMessage,
    send,
    addListener,
    buildViewInMessageRoom,
  ]);
};

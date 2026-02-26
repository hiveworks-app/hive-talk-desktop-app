'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import {
  updateChatRoomListWithDeletion,
  upsertChatRoomListWithMessage,
} from '@/features/chat-room-list/updater';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import {
  WS_CHANNEL_TYPE,
  WS_OPERATION,
  WebSocketChannelTypes,
  WebSocketEnvelope,
  WebSocketReceiveReadItemProps,
  WebSocketReceiveTagProps,
  WebSocketSingleMessagePayload,
  isAddTagBroadcast,
  isBroadcast,
  isDeleteMessage,
  isExitMessageRoomBroadcast,
  isPublish,
  isReadMessage,
  isRemoveTagBroadcast,
  isRoomInvite,
  parseSocketResponseType,
} from '@/shared/types/websocket';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

type Listener = (data: WebSocketEnvelope) => void;

interface WebSocketContextValue {
  send: (data: unknown) => void;
  addListener: (id: string, listener: Listener) => void;
  removeListener: (id: string) => void;
  isConnected: boolean;
}

const getTargetQueryKey = (channelType: WebSocketChannelTypes | undefined) => {
  switch (channelType) {
    case WS_CHANNEL_TYPE.DIRECT_MESSAGE:
      return DM_ROOM_LIST_KEY;
    case WS_CHANNEL_TYPE.GROUP_MESSAGE:
      return GM_ROOM_LIST_KEY;
    case WS_CHANNEL_TYPE.EXTERNAL_MESSAGE:
      return EM_ROOM_LIST_KEY;
    default:
      return null;
  }
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
  const loginUserId = useAuthStore(state => state.user)?.id;
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Record<string, Listener>>({});
  const isConnectingRef = useRef(false);
  const forceCloseRef = useRef(false);
  const pendingQueue = useRef<unknown[]>([]);
  const processedReadEventsRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const { buildSubscribeMessage } = useWebSocketMessageBuilder({
    type: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
    channelId: null,
  });

  const disconnectWebSocket = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      forceCloseRef.current = true;
      listenersRef.current = {};
      ws.close();
    }
    wsRef.current = null;
    isConnectingRef.current = false;
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connectWebSocket = useCallback(
    (newToken?: string) => {
      const accessToken = newToken || useAuthStore.getState().accessToken;

      if (!WS_URL || !accessToken || !loginUserId || !isPageVisible) {
        return;
      }

      if (wsRef.current || isConnectingRef.current) {
        return;
      }

      isConnectingRef.current = true;

      const ws = new WebSocket(
        `${WS_URL}/app/ws?Authorization=${encodeURIComponent(accessToken)}`,
      );

      ws.onopen = () => {
        console.info('[WS] ✅ 연결 성공');
        wsRef.current = ws;
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        pendingQueue.current.forEach(msg => {
          ws.send(JSON.stringify(msg));
        });
        pendingQueue.current = [];
        isConnectingRef.current = false;
      };

      ws.onmessage = event => {
        const loginUserIdInner = useAuthStore.getState().user?.id;
        let envelope: WebSocketEnvelope;
        let globalChannelType: WebSocketChannelTypes | undefined;

        try {
          envelope = JSON.parse(event.data) as WebSocketEnvelope;
          console.info('[WS] 📩 수신:', envelope.socketResponseType);
        } catch {
          Object.values(listenersRef.current).forEach(listener =>
            listener(event.data as WebSocketEnvelope),
          );
          return;
        }

        if (isBroadcast(envelope)) {
          // response 본문의 channelType 우선, 없으면 socketResponseType 문자열에서 파싱 (방어 코드)
          const { channelType } = envelope.response;
          globalChannelType =
            channelType ||
            (parseSocketResponseType(envelope.socketResponseType)?.channelType as WebSocketChannelTypes | undefined);
        }

        // 초대받은 경우 자동 구독
        if (isRoomInvite(envelope)) {
          const channelId = envelope.response.payload;
          const channelIdOverride = { channelIdOverride: channelId };
          const channelTypeOverride = globalChannelType && {
            channelTypeOverride: globalChannelType,
          };
          const subMsg = buildSubscribeMessage({
            ...channelIdOverride,
            ...channelTypeOverride,
          });
          send(subMsg);
          return;
        }

        // 읽음 처리
        if (isReadMessage(envelope)) {
          const currentChannelType = globalChannelType || envelope.response.channelType;
          const { items: readItems } = envelope.response.payload;

          const newMyReadItems = readItems.filter(item => {
            const eventKey = `${item.messageId}:${item.userId}`;
            if (processedReadEventsRef.current.has(eventKey)) return false;
            processedReadEventsRef.current.add(eventKey);
            return item.userId === String(loginUserIdInner);
          });

          if (newMyReadItems.length > 0) {
            const readCountByRoom = new Map<string, number>();
            newMyReadItems.forEach(item => {
              const current = readCountByRoom.get(item.roomId) ?? 0;
              readCountByRoom.set(item.roomId, current + 1);
            });

            const targetQueryKey = getTargetQueryKey(currentChannelType);
            if (targetQueryKey) {
              queryClient.setQueryData(
                targetQueryKey,
                (prev: GetChatRoomListItemType[] | undefined) => {
                  if (!prev) return prev;
                  return prev.map(room => {
                    const decrementCount = readCountByRoom.get(room.roomModel.roomId);
                    if (decrementCount) {
                      return {
                        ...room,
                        notReadCount: Math.max(0, (room.notReadCount ?? 0) - decrementCount),
                      };
                    }
                    return room;
                  });
                },
              );
            }
          }

          // readItems를 메시지리스트에 병합
          if (readItems.length > 0) {
            const targetQueryKey2 = getTargetQueryKey(currentChannelType);
            if (targetQueryKey2) {
              queryClient.setQueryData(
                targetQueryKey2,
                (prev: GetChatRoomListItemType[] | undefined) => {
                  if (!prev) return prev;

                  const readItemsByMessageId = new Map<string, WebSocketReceiveReadItemProps[]>();
                  readItems.forEach(readItem => {
                    const existing = readItemsByMessageId.get(readItem.messageId) ?? [];
                    readItemsByMessageId.set(readItem.messageId, [...existing, readItem]);
                  });

                  return prev.map(room => {
                    const hasReadEvent = readItems.some(
                      item => item.roomId === room.roomModel.roomId,
                    );
                    if (!hasReadEvent) return room;

                    const updatedMessageList = room.messageList.map(msg => {
                      const newReadItems = readItemsByMessageId.get(msg.message.id);
                      if (!newReadItems) return msg;

                      const existingReadItems = msg.readItems?.items ?? [];
                      const existingUserIds = new Set(existingReadItems.map(r => r.userId));
                      const filteredNewReadItems = newReadItems.filter(
                        r => !existingUserIds.has(r.userId),
                      );

                      if (filteredNewReadItems.length === 0) return msg;

                      return {
                        ...msg,
                        readItems: { items: [...existingReadItems, ...filteredNewReadItems] },
                      };
                    });

                    return { ...room, messageList: updatedMessageList };
                  });
                },
              );
            }
          }

          Object.values(listenersRef.current).forEach(listener => listener(envelope));
          return;
        }

        // PUB 메시지
        if (isPublish(envelope)) {
          const pubPayload = envelope.response.payload as WebSocketSingleMessagePayload;
          const roomId = pubPayload.message.roomId;
          const currentChannelType = globalChannelType || envelope.response.channelType;
          console.info('[WS] 📨 PUB 수신:', { roomId, channelType: currentChannelType, sender: pubPayload.sender?.name });

          const rawReadItems: WebSocketReceiveReadItemProps[] = Array.isArray(pubPayload.readItems)
            ? (pubPayload.readItems as unknown as WebSocketReceiveReadItemProps[])
            : (pubPayload.readItems?.items ?? []);

          const senderId = pubPayload.sender?.userId;
          const hasSenderRead = rawReadItems.some(item => item.userId === senderId);
          if (senderId && !hasSenderRead) {
            rawReadItems.push({
              roomId,
              messageId: pubPayload.message.id,
              userId: senderId,
              readAt: new Date(pubPayload.message.createdAt),
            });
          }

          const normalizedPayload: WebSocketSingleMessagePayload = {
            ...pubPayload,
            tag: Array.isArray(pubPayload.tag)
              ? { items: pubPayload.tag as unknown as WebSocketReceiveTagProps[] }
              : (pubPayload.tag ?? { items: [] }),
            readItems: { items: rawReadItems },
          };

          const isMySentMessage = normalizedPayload.sender?.userId === String(loginUserIdInner);
          const listener = listenersRef.current[roomId];
          const isRoomActive = Boolean(listener);
          if (listener) {
            listener(envelope);
          }

          // 채팅방 목록 React Query 캐시 갱신 (RN 패턴과 동일: setQueryData 내부에서 원자적 처리)
          const targetQueryKey = getTargetQueryKey(currentChannelType);
          if (targetQueryKey) {
            // setQueryData 밖에서 먼저 캐시 확인
            // (invalidateQueries를 setQueryData 내부에서 호출하면
            //  setQueryData의 success 액션이 isInvalidated 플래그를 초기화해서 refetch가 안 됨)
            const prev = queryClient.getQueryData<GetChatRoomListItemType[]>(targetQueryKey);
            const list = prev ?? [];
            const hasRoom = list.some(room => room.roomModel.roomId === roomId);

            console.info('[WS] 📋 캐시 업데이트:', { queryKey: targetQueryKey, prevLength: list.length, hasRoom });

            if (hasRoom) {
              queryClient.setQueryData<GetChatRoomListItemType[]>(
                targetQueryKey,
                upsertChatRoomListWithMessage(list, normalizedPayload, { isRoomActive }),
              );
            } else {
              // 새 방: 서버에서 목록 다시 가져오기
              queryClient.invalidateQueries({ queryKey: targetQueryKey });
            }
          } else {
            console.warn('[WS] ⚠️ PUB: targetQueryKey가 null — channelType:', currentChannelType, 'socketResponseType:', envelope.socketResponseType);
          }

          // 웹 알림 (내가 보낸 메시지가 아니고, 방이 비활성일 때)
          if (!isMySentMessage && !isRoomActive && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              const senderName = normalizedPayload.sender?.name ?? '사용자';
              new Notification(senderName, {
                body: normalizedPayload.message.payload && 'content' in normalizedPayload.message.payload
                  ? normalizedPayload.message.payload.content
                  : '새 메시지',
                tag: roomId,
              });
            }
          }

          return;
        }

        // 메시지 삭제
        if (isDeleteMessage(envelope)) {
          const pubPayload = envelope.response.payload as WebSocketSingleMessagePayload;
          const roomId = pubPayload.message.roomId;
          const messageId = pubPayload.message.id;
          if (!messageId) return;

          const listener = listenersRef.current[roomId];
          if (listener) listener(envelope);

          const currentChannelType = globalChannelType || envelope.response.channelType;
          const targetQueryKey = getTargetQueryKey(currentChannelType);
          if (targetQueryKey) {
            queryClient.setQueryData<GetChatRoomListItemType[]>(targetQueryKey, prev =>
              updateChatRoomListWithDeletion(prev, roomId, messageId),
            );
          }
          return;
        }

        // ADD_TAG
        if (isAddTagBroadcast(envelope)) {
          Object.values(listenersRef.current).forEach(listener => listener(envelope));
          return;
        }

        // REMOVE_TAG
        if (isRemoveTagBroadcast(envelope)) {
          useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
          Object.values(listenersRef.current).forEach(listener => listener(envelope));
          return;
        }

        // 방 나감
        if (isExitMessageRoomBroadcast(envelope)) {
          if (!loginUserId) return;
          const { userId, roomId } = envelope.response.payload;
          if (userId !== loginUserId) {
            queryClient.setQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY, prev => {
              if (!prev) return [];
              return prev.map(room => {
                if (room.roomModel.roomId !== roomId) return room;
                const updatedParticipantDetail = room.roomModel.participantDetail
                  ? String(room.roomModel.participantDetail.userId) === userId
                    ? { ...room.roomModel.participantDetail, isExit: true }
                    : room.roomModel.participantDetail
                  : undefined;
                return {
                  ...room,
                  roomModel: { ...room.roomModel, participantDetail: updatedParticipantDetail },
                };
              });
            });

            const currentChatRoomId = useChatRoomInfo.getState().roomId;
            if (currentChatRoomId === roomId) {
              useChatRoomInfo.setState({ otherUserIsExit: true, invitedUserIds: [userId] });
            }
          }
        }

        // 기타
        Object.values(listenersRef.current).forEach(listener => listener(envelope));
      };

      ws.onerror = (err) => {
        console.error('[WS] ❌ 에러:', err);
        isConnectingRef.current = false;
      };

      ws.onclose = async e => {
        console.info('[WS] 🔌 연결 종료:', { code: e.code, reason: e.reason });
        wsRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;

        const wasForce = forceCloseRef.current;
        forceCloseRef.current = false;

        const reason = e.reason ?? '';

        if (reason.includes('401')) {
          try {
            const newToken = await refreshAccessToken();
            if (newToken) {
              connectWebSocket(newToken);
            } else {
              useAuthStore.getState().logout();
              window.location.href = '/login';
            }
          } catch {
            useAuthStore.getState().logout();
            window.location.href = '/login';
          }
          return;
        }

        if (wasForce) return;

        // 비정상 종료 시 지수 백오프로 재연결 (1s → 2s → 4s → ... → 최대 30s, 최대 10회)
        const MAX_RECONNECT_ATTEMPTS = 10;
        const attempt = reconnectAttemptRef.current;
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          console.warn(`[WS] 최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달`);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(() => {
          if (!forceCloseRef.current && isPageVisible) {
            connectWebSocket();
          }
        }, delay);
      };

      wsRef.current = ws;
    },
    [WS_URL, isPageVisible, queryClient, loginUserId, buildSubscribeMessage],
  );

  const send = useCallback(
    (data: unknown) => {
      const ws = wsRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (forceCloseRef.current || ws?.readyState === WebSocket.CLOSED) {
          return;
        }
        pendingQueue.current.push(data);
        if (!isConnectingRef.current) connectWebSocket();
        return;
      }

      try {
        const payload = data as Record<string, unknown>;
        console.info('[WS] 📤 전송:', payload.operationType, payload.channelType, payload.channelId);
        ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('[WS] send 에러:', error);
      }
    },
    [connectWebSocket],
  );

  const addListener = useCallback((id: string, listener: Listener) => {
    listenersRef.current[id] = listener;
  }, []);

  const removeListener = useCallback((id: string) => {
    delete listenersRef.current[id];
  }, []);

  // visibilitychange (AppState 대체)
  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 연결/재연결
  useEffect(() => {
    const loginUserId = useAuthStore.getState().user?.id;

    if (!WS_URL || !loginUserId || !isPageVisible) {
      disconnectWebSocket();
      return;
    }

    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [WS_URL, isPageVisible, disconnectWebSocket, connectWebSocket]);

  // WebSocket (재)연결 시 채팅방 목록 갱신 + 전체 방 구독(SUB) 복원
  // WebSocket 구독은 세션 기반이라 재연결 시 모든 구독이 사라짐
  // 캐시된 방 목록을 기반으로 SUB를 보내서 broadcast 수신을 보장
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      // 1. 캐시된 모든 방에 SUB 전송 (broadcast 수신 보장)
      const channelTypes = [
        { key: DM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.DIRECT_MESSAGE },
        { key: GM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.GROUP_MESSAGE },
        { key: EM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE },
      ] as const;

      channelTypes.forEach(({ key, type }) => {
        const rooms = queryClient.getQueryData<GetChatRoomListItemType[]>(key) ?? [];
        rooms.forEach(room => {
          send({
            operationType: WS_OPERATION.SUB,
            channelType: type,
            channelId: room.roomModel.roomId,
            payload: null,
          });
        });
      });

      // 2. 서버에서 최신 목록 가져오기 (놓친 메시지 반영)
      queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, queryClient, send]);

  const value: WebSocketContextValue = { send, addListener, removeListener, isConnected };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useAppWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useAppWebSocket must be used within WebSocketProvider');
  return ctx;
};

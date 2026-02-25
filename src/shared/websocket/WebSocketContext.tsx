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
        } catch {
          Object.values(listenersRef.current).forEach(listener =>
            listener(event.data as WebSocketEnvelope),
          );
          return;
        }

        if (isBroadcast(envelope)) {
          const { channelType } = envelope.response;
          globalChannelType = channelType;
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

          // 채팅방 목록 React Query 캐시 갱신
          const targetQueryKey = getTargetQueryKey(currentChannelType);
          if (targetQueryKey) {
            const prevList = queryClient.getQueryData<GetChatRoomListItemType[]>(targetQueryKey) ?? [];
            const hasRoom = prevList.some(room => room.roomModel.roomId === roomId);

            if (!hasRoom) {
              queryClient.invalidateQueries({ queryKey: targetQueryKey });
            } else {
              queryClient.setQueryData<GetChatRoomListItemType[]>(
                targetQueryKey,
                prev => upsertChatRoomListWithMessage(prev, normalizedPayload, { isRoomActive }),
              );
            }
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

      ws.onerror = () => {
        isConnectingRef.current = false;
      };

      ws.onclose = async e => {
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

  const value: WebSocketContextValue = { send, addListener, removeListener, isConnected };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useAppWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useAppWebSocket must be used within WebSocketProvider');
  return ctx;
};

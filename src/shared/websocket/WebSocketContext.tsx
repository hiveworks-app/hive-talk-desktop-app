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
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WS_OPERATION } from '@/shared/types/websocket';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { routeMessage } from './handlers/messageRouter';
import { useElectronNotification } from './hooks/useElectronNotification';
import type { Listener, WebSocketContextValue } from './type';

export type { Listener, WebSocketContextValue } from './type';

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routerRef = useRef(router);
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
  const sendRef = useRef<(data: unknown) => void>(() => {});
  const pendingReadCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const connectWebSocketRef = useRef<(newToken?: string) => void>(() => {});
  const isElectronRef = useRef(
    typeof window !== 'undefined' &&
    !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron,
  );
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
      if (!WS_URL || !accessToken || !loginUserId || !isPageVisible) return;
      if (wsRef.current || isConnectingRef.current) return;

      isConnectingRef.current = true;
      const ws = new WebSocket(
        `${WS_URL}/app/ws?Authorization=${encodeURIComponent(accessToken)}`,
      );

      ws.onopen = () => {
        wsRef.current = ws;
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        pendingQueue.current.forEach(msg => ws.send(JSON.stringify(msg)));
        pendingQueue.current = [];
        isConnectingRef.current = false;
      };

      ws.onmessage = event => {
        routeMessage(event.data, {
          queryClient, listenersRef, processedReadEventsRef, pendingReadCallbacksRef,
          sendRef, isElectronRef, buildSubscribeMessage,
          loginUserId: useAuthStore.getState().user?.id,
        });
      };

      ws.onerror = (err) => {
        console.warn('[WS] ⚠️ 연결 실패:', err);
        isConnectingRef.current = false;
      };

      ws.onclose = async e => {
        wsRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;

        const wasForce = forceCloseRef.current;
        forceCloseRef.current = false;
        const reason = e.reason ?? '';

        if (reason.includes('401') || e.code === 1006) {
          try {
            const newTk = await refreshAccessToken();
            if (newTk) { connectWebSocketRef.current(newTk); return; }
          } catch { /* refresh 실패 */ }
          if (reason.includes('401')) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return;
          }
        }

        if (wasForce) return;

        const MAX_RECONNECT = 10;
        const attempt = reconnectAttemptRef.current;
        if (attempt >= MAX_RECONNECT) {
          console.warn(`[WS] 최대 재연결 시도 횟수(${MAX_RECONNECT})에 도달`);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(async () => {
          if (!forceCloseRef.current && isPageVisible) {
            const freshToken = await refreshAccessToken().catch(() => null);
            connectWebSocketRef.current(freshToken ?? undefined);
          }
        }, delay);
      };

      wsRef.current = ws;
    },
    [WS_URL, isPageVisible, queryClient, loginUserId, buildSubscribeMessage],
  );

  const send = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (forceCloseRef.current || ws?.readyState === WebSocket.CLOSED) return;
      pendingQueue.current.push(data);
      if (!isConnectingRef.current) connectWebSocketRef.current();
      return;
    }
    try { ws.send(JSON.stringify(data)); }
    catch (error) { console.error('[WS] send 에러:', error); }
  }, []);

  // ref 동기화 (순환 참조 해소)
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
    sendRef.current = send;
    routerRef.current = router;
  });

  const addListener = useCallback((id: string, listener: Listener) => {
    listenersRef.current[id] = listener;
  }, []);

  const removeListener = useCallback((id: string) => {
    delete listenersRef.current[id];
  }, []);

  // Electron 알림 처리 (클릭 + 읽음)
  useElectronNotification({ routerRef, sendRef, pendingReadCallbacksRef });

  // visibilitychange (Electron은 항상 visible)
  const isElectron = typeof window !== 'undefined' &&
    !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron;

  useEffect(() => {
    if (isElectron) return;
    const handleVisibility = () => setIsPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isElectron]);

  // 연결/재연결
  useEffect(() => {
    const userId = useAuthStore.getState().user?.id;
    if (!WS_URL || !userId || !isPageVisible) return;
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [WS_URL, isPageVisible, disconnectWebSocket, connectWebSocket]);

  // (재)연결 시 캐시된 방 구독 복원 + 목록 갱신
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
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

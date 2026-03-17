'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { useAuthStore } from '@/store/auth/authStore';
import { routeMessage } from './handlers/messageRouter';
import type { Listener } from './type';

interface WebSocketCoreConfig {
  WS_URL: string | undefined;
  loginUserId: string | number | undefined;
  queryClient: QueryClient;
  buildSubscribeMessage: (opts: { channelIdOverride?: string }) => unknown;
}

export function useWebSocketCore({ WS_URL, loginUserId, queryClient, buildSubscribeMessage }: WebSocketCoreConfig) {
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
    typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron,
  );
  const [isConnected, setIsConnected] = useState(false);

  const disconnectWebSocket = useCallback(() => {
    const ws = wsRef.current;
    if (ws) { forceCloseRef.current = true; listenersRef.current = {}; ws.close(); }
    wsRef.current = null;
    isConnectingRef.current = false;
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    setIsConnected(false);
  }, []);

  const connectWebSocket = useCallback((newToken?: string) => {
    const accessToken = newToken || useAuthStore.getState().accessToken;
    if (!WS_URL || !accessToken || !loginUserId) return;
    if (wsRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;
    const ws = new WebSocket(`${WS_URL}/app/ws?Authorization=${encodeURIComponent(accessToken)}`);

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

    ws.onerror = (err) => { console.warn('[WS] ⚠️ 연결 실패:', err); isConnectingRef.current = false; };

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
        if (reason.includes('401')) { useAuthStore.getState().logout(); window.location.href = '/login'; return; }
      }

      if (wasForce) return;
      const MAX_RECONNECT = 10;
      const attempt = reconnectAttemptRef.current;
      if (attempt >= MAX_RECONNECT) { console.warn(`[WS] 최대 재연결 시도 횟수(${MAX_RECONNECT})에 도달`); return; }
      const delay = attempt === 0 ? 0 : Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(async () => {
        if (!forceCloseRef.current) {
          const freshToken = await refreshAccessToken().catch(() => null);
          connectWebSocketRef.current(freshToken ?? undefined);
        }
      }, delay);
    };

    wsRef.current = ws;
  }, [WS_URL, queryClient, loginUserId, buildSubscribeMessage]);

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

  useEffect(() => { connectWebSocketRef.current = connectWebSocket; sendRef.current = send; });

  return {
    send, isConnected, connectWebSocket, disconnectWebSocket,
    listenersRef, sendRef, pendingReadCallbacksRef, isElectronRef,
  };
}

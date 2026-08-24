'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { handleForceLogout, refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { isSessionDisconnect } from '@/shared/types/websocket';
import type { WebSocketEnvelope } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useSessionDisconnectStore } from '@/store/auth/sessionDisconnectStore';
import { routeMessage } from './handlers/messageRouter';
import { createHeartbeat, isPongMessage, type HeartbeatController } from './heartbeat';
import type { Listener } from './type';

interface WebSocketCoreConfig {
  WS_URL: string | undefined;
  loginUserId: string | number | undefined;
  queryClient: QueryClient;
  buildSubscribeMessage: (opts: { channelIdOverride?: string }) => unknown;
  /** 인바운드 원문 훅 — 허브(메인 창)가 멀티 채팅창으로 중계할 때 사용 (PONG 제외) */
  onRawMessage?: (raw: string) => void;
  /** 데스크톱 알림 억제 — 팝업은 허브가 이미 띄우므로 중복 방지 */
  suppressNotification?: boolean;
}

export function useWebSocketCore({
  WS_URL, loginUserId, queryClient, buildSubscribeMessage, onRawMessage, suppressNotification,
}: WebSocketCoreConfig) {
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
  // 애플리케이션 레벨 하트비트: Cloudflare idle 끊김 방지 + 좀비 소켓 감지
  const heartbeatRef = useRef<HeartbeatController | null>(null);
  if (heartbeatRef.current === null) {
    heartbeatRef.current = createHeartbeat({
      // 죽은 연결 판정 → close()로 기존 onclose 재연결 경로(백오프/토큰갱신)에 태움
      onDead: ws => { try { ws.close(); } catch { /* 이미 닫힘 */ } },
    });
  }
  const [isConnected, setIsConnected] = useState(false);

  /* 라우팅/중계 훅은 렌더마다 정체성이 바뀌므로 ref 경유로 고정한다 —
     connectWebSocket의 deps에 넣으면 소켓이 불필요하게 재생성된다. */
  const onRawMessageRef = useRef(onRawMessage);
  const routeRawMessageRef = useRef<(raw: string) => void>(() => {});

  /** 원문 1건을 라우팅한다. 소켓에서 온 것과 IPC 중계로 온 것이 같은 경로를 타도록 분리했다. */
  const routeRawMessage = useCallback((raw: string) => {
    routeMessage(raw, {
      queryClient, listenersRef, processedReadEventsRef, pendingReadCallbacksRef,
      sendRef, isElectronRef, buildSubscribeMessage,
      loginUserId: useAuthStore.getState().user?.id,
      suppressNotification,
    });
  }, [queryClient, buildSubscribeMessage, suppressNotification]);

  const disconnectWebSocket = useCallback(() => {
    heartbeatRef.current?.stop();
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
    // 중복 로그인 안내(SC010) 유예 중 — 모든 재연결 트리거가 이 함수를 거치므로 여기서 일괄 차단
    if (useSessionDisconnectStore.getState().noticeVisible) return;

    isConnectingRef.current = true;
    const ws = new WebSocket(`${WS_URL}/app/ws?Authorization=${encodeURIComponent(accessToken)}`);

    ws.onopen = () => {
      const wasReconnect = reconnectAttemptRef.current > 0;
      wsRef.current = ws;
      reconnectAttemptRef.current = 0;
      setIsConnected(true);
      heartbeatRef.current?.start(ws);
      pendingQueue.current.forEach(msg => ws.send(JSON.stringify(msg)));
      pendingQueue.current = [];
      isConnectingRef.current = false;

      // 재연결 성공 — 끊김 동안 유실된 메시지·방 목록 재수렴 (RN 패리티)
      if (wasReconnect) {
        queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
        queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
        queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
      }
    };

    ws.onmessage = event => {
      // 모든 인바운드는 생존 증거 — PONG 대기 해제 (PING/PONG 생존 판정의 기준)
      heartbeatRef.current?.notifyInbound();

      // PONG은 생존 신호 역할만 하므로 라우팅 등 후속 처리를 생략
      let parsed: unknown = null;
      try { parsed = JSON.parse(event.data); } catch { /* 비 JSON은 그대로 라우팅 */ }
      if (isPongMessage(parsed)) return;

      // 멀티 채팅창(팝업)으로 원문 중계.
      // 서버는 한 계정당 최신 소켓 하나에만 브로드캐스트하므로 창마다 소켓을 열 수 없다 —
      // 소켓은 이 창(허브)만 갖고, 나머지 창은 여기서 넘긴 원문으로 같은 라우팅을 돈다.
      onRawMessageRef.current?.(event.data);

      // 🔌 SESSION/DISCONNECT (중복 로그인 SC010) → 소켓 종료 + 강제 종료 안내 다이얼로그.
      // 로그아웃은 다이얼로그 확인 시점에 수행 — 유예 구간 자동 동작은 noticeVisible 가드가 차단
      if (parsed !== null && typeof parsed === 'object' && isSessionDisconnect(parsed as WebSocketEnvelope)) {
        const envelope = parsed as { response?: { code?: string; message?: string } };
        console.info('[WS] SESSION/DISCONNECT 수신 → 강제 종료 안내', envelope.response?.code, envelope.response?.message);
        useSessionDisconnectStore.getState().showNotice();
        disconnectWebSocket();
        return;
      }

      routeRawMessageRef.current(event.data);
    };

    ws.onerror = (err) => { console.warn('[WS] ⚠️ 연결 실패:', err); isConnectingRef.current = false; };

    ws.onclose = async e => {
      heartbeatRef.current?.stop();
      wsRef.current = null;
      setIsConnected(false);
      isConnectingRef.current = false;
      const wasForce = forceCloseRef.current;
      forceCloseRef.current = false;
      const reason = e.reason ?? '';

      // 중복 로그인 안내(SC010) 유예 중 — 재연결/토큰 갱신 시도 없이 다이얼로그 확인 대기
      if (useSessionDisconnectStore.getState().noticeVisible) return;

      // 오프라인이면 토큰 갱신/재연결 시도 없이 online 이벤트에서 재연결
      if (!navigator.onLine) {
        const handleOnline = () => {
          window.removeEventListener('online', handleOnline);
          reconnectAttemptRef.current = 0;
          connectWebSocketRef.current();
        };
        window.addEventListener('online', handleOnline);
        return;
      }

      const MAX_RECONNECT = 10;

      // 401/비정상 종료(1006) → 토큰 갱신 후 재연결. RN 앱과 동일하게 재시도 횟수를 캡한다.
      // 토큰이 영구 거부되는 상황(예: 이메일=로그인ID 변경으로 서버가 세션 무효화)에서
      // refresh→재연결→1006 무한 루프를 막고, 한도 초과/갱신 실패 시 강제 로그아웃한다.
      if (reason.includes('401') || e.code === 1006) {
        const attempt = reconnectAttemptRef.current;
        if (attempt >= MAX_RECONNECT) {
          console.warn(`[WS] 인증 재연결 ${MAX_RECONNECT}회 초과 → 강제 로그아웃`);
          handleForceLogout();
          return;
        }
        reconnectAttemptRef.current = attempt + 1;
        const delay = attempt === 0 ? 0 : Math.min(1000 * Math.pow(2, attempt - 1), 30000);

        let newToken: string | null = null;
        try {
          newToken = await refreshAccessToken();
        } catch {
          /* refresh 예외 → 아래에서 강제 로그아웃 */
        }
        if (!newToken) {
          // refresh가 SC010으로 거절된 경우 — 강제 로그아웃 대신 안내 다이얼로그 확인 대기
          if (useSessionDisconnectStore.getState().noticeVisible) return;
          handleForceLogout();
          return;
        }
        const token = newToken;
        reconnectTimerRef.current = setTimeout(() => {
          if (!forceCloseRef.current) connectWebSocketRef.current(token);
        }, delay);
        return;
      }

      if (wasForce) return;

      // 그 외 비정상 종료 → 백오프 재연결. 영구 포기 제거 — 캡 도달 후에도 30초 간격
      // 저빈도 무한 재시도 (RN 패리티: 잠깐의 서버 장애로 앱 재시작 전까지 먹통이 되는 것 방지)
      const attempt = reconnectAttemptRef.current;
      if (attempt === MAX_RECONNECT) console.warn(`[WS] 재연결 ${MAX_RECONNECT}회 초과 — 30초 간격 저빈도 재시도로 전환`);
      const delay = attempt === 0 ? 0 : Math.min(1000 * Math.pow(2, Math.min(attempt - 1, 5)), 30000);
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

  const removePendingPublish = useCallback((content: string) => {
    pendingQueue.current = pendingQueue.current.filter(msg => {
      const m = msg as Record<string, unknown>;
      if (m.operationType !== 'PUB') return true;
      const payload = m.payload as Record<string, unknown> | undefined;
      if (!payload || payload.messageContentType !== 'TEXT') return true;
      const inner = payload.payload as Record<string, unknown> | undefined;
      return inner?.content !== content;
    });
  }, []);

  const send = useCallback((data: unknown) => {
    // 중복 로그인 안내(SC010) 유예 중 — 발행 fail-closed (재연결 큐잉도 차단)
    if (useSessionDisconnectStore.getState().noticeVisible) return;
    const ws = wsRef.current;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!ws || ws.readyState !== WebSocket.OPEN || !isOnline) {
      if (forceCloseRef.current || ws?.readyState === WebSocket.CLOSED) return;
      pendingQueue.current.push(data);
      if (!isConnectingRef.current) connectWebSocketRef.current();
      return;
    }
    try { ws.send(JSON.stringify(data)); }
    catch (error) { console.error('[WS] send 에러:', error); }
  }, []);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
    sendRef.current = send;
    onRawMessageRef.current = onRawMessage;
    routeRawMessageRef.current = routeRawMessage;
  });

  return {
    send, isConnected, connectWebSocket, disconnectWebSocket, routeRawMessage,
    listenersRef, sendRef, pendingReadCallbacksRef, isElectronRef, removePendingPublish,
  };
}

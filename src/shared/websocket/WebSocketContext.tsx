'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WS_OPERATION } from '@/shared/types/websocket';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { isPopupWindow } from '@/shared/utils/popupWindow';
import { useElectronNotification } from './hooks/useElectronNotification';
import { useWebSocketCore } from './useWebSocketCore';
import { isRelayAvailable, wsRelay } from './wsRelay';
import type { Listener, WebSocketContextValue } from './type';

export type { Listener, WebSocketContextValue } from './type';

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const router = useAppRouter();
  const routerRef = useRef(router);
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
  const loginUserId = useAuthStore(state => state.user)?.id;
  const { buildSubscribeMessage } = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.DIRECT_MESSAGE, channelId: null });

  /* 소켓은 앱 전체에 하나만 둔다.
     서버가 한 계정당 최신 소켓 하나에만 브로드캐스트하므로, 창마다 소켓을 열면 나중에 연 창이
     수신을 독점하고 먼저 열린 창은 자기 메시지의 에코조차 못 받는다 (wsRelay.ts 주석 참조).
     → 메인 창 = 허브(실제 소켓), 멀티 채팅창(팝업) = 스포크(IPC 중계).
     판정은 마운트 시 1회 — 창의 역할은 수명 동안 바뀌지 않는다. */
  const [isRelayMode] = useState(() => isPopupWindow() && isRelayAvailable());
  const isHub = !isRelayMode;
  const canRelay = isRelayAvailable();

  const { send: socketSend, isConnected: socketConnected, connectWebSocket, disconnectWebSocket, listenersRef, sendRef, pendingReadCallbacksRef, removePendingPublish, routeRawMessage } =
    useWebSocketCore({
      WS_URL, loginUserId, queryClient, buildSubscribeMessage,
      // 허브만 중계한다 — 스포크가 받은 걸 되뿌리면 무한 루프가 된다.
      // 팝업이 하나도 없을 때도 IPC 1회가 나가지만, 메인 프로세스가 빈 목록에 뿌리므로 비용은 미미하다.
      onRawMessage: isHub && canRelay ? wsRelay.publishInbound : undefined,
      // 팝업이 같은 메시지를 또 라우팅하므로 알림은 허브만 띄운다
      suppressNotification: isRelayMode,
    });

  // 스포크의 연결 상태는 허브가 알려준다 (자기 소켓이 없으므로 socketConnected는 항상 false)
  const [relayConnected, setRelayConnected] = useState(false);
  const isConnected = isRelayMode ? relayConnected : socketConnected;

  const relaySend = useCallback((data: unknown) => { wsRelay.send(data); }, []);
  const send = isRelayMode ? relaySend : socketSend;

  useEffect(() => { routerRef.current = router; });

  /* 핸들러(자동 SUB·읽음 등)는 sendRef로 발신한다. core가 매 렌더 sendRef를 자기 send로 덮으므로,
     스포크에서는 그 뒤에 중계 send로 다시 덮어야 한다 — core의 effect가 먼저 실행되므로 순서가 보장된다. */
  useEffect(() => { if (isRelayMode) sendRef.current = send; });

  // ── 허브: 팝업의 전송 위임 수행 + 연결 상태 공급 ──
  const socketConnectedRef = useRef(false);
  useEffect(() => { socketConnectedRef.current = socketConnected; });

  useEffect(() => {
    if (!isHub || !canRelay) return;
    const offOutbound = wsRelay.onOutbound(data => sendRef.current(data));
    const offStatusRequest = wsRelay.onStatusRequest(() => wsRelay.publishStatus(socketConnectedRef.current));
    return () => { offOutbound(); offStatusRequest(); };
  }, [isHub, canRelay, sendRef]);

  useEffect(() => {
    if (!isHub || !canRelay) return;
    wsRelay.publishStatus(socketConnected);
  }, [isHub, canRelay, socketConnected]);

  // ── 스포크: 중계된 원문을 허브와 동일한 경로로 라우팅 ──
  useEffect(() => {
    if (!isRelayMode) return;
    const offMessage = wsRelay.onMessage(routeRawMessage);
    const offStatus = wsRelay.onStatusChanged(setRelayConnected);
    // 창이 열리는 사이에 상태 변화 이벤트를 놓쳤을 수 있으므로 현재 값을 한 번 물어본다
    wsRelay.requestStatus();
    return () => { offMessage(); offStatus(); };
  }, [isRelayMode, routeRawMessage]);

  const addListener = useCallback((id: string, listener: Listener) => { listenersRef.current[id] = listener; }, [listenersRef]);
  const removeListener = useCallback((id: string) => { delete listenersRef.current[id]; }, [listenersRef]);

  // 알림 클릭/읽음 처리는 허브만 — 팝업이 처리하면 팝업이 다른 방으로 이동해버린다
  useElectronNotification({ routerRef, sendRef, pendingReadCallbacksRef, enabled: isHub });

  useEffect(() => {
    if (isRelayMode) return; // 스포크는 소켓을 열지 않는다
    const userId = useAuthStore.getState().user?.id;
    if (!WS_URL || !userId) return;
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [WS_URL, disconnectWebSocket, connectWebSocket, isRelayMode]);

  const prevConnectedRef = useRef(false);
  useEffect(() => {
    // 전체 방 재구독은 소켓 주인(허브)의 몫 — 스포크가 또 하면 같은 SUB이 두 번 나간다
    if (isRelayMode) return;
    if (isConnected && !prevConnectedRef.current) {
      const channelTypes = [
        { key: DM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.DIRECT_MESSAGE },
        { key: GM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.GROUP_MESSAGE },
        { key: EM_ROOM_LIST_KEY, type: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE },
      ] as const;

      channelTypes.forEach(({ key, type }) => {
        const rooms = queryClient.getQueryData<GetChatRoomListItemType[]>(key) ?? [];
        rooms.forEach(room => {
          send({ operationType: WS_OPERATION.SUB, channelType: type, channelId: room.roomModel.roomId, payload: null });
        });
      });

      queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, queryClient, send, isRelayMode]);

  const value: WebSocketContextValue = { send, addListener, removeListener, isConnected, removePendingPublish };
  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useAppWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useAppWebSocket must be used within WebSocketProvider');
  return ctx;
};

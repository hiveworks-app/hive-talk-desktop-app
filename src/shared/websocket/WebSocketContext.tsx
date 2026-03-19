'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WS_OPERATION } from '@/shared/types/websocket';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useElectronNotification } from './hooks/useElectronNotification';
import { useWebSocketCore } from './useWebSocketCore';
import type { Listener, WebSocketContextValue } from './type';

export type { Listener, WebSocketContextValue } from './type';

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routerRef = useRef(router);
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
  const loginUserId = useAuthStore(state => state.user)?.id;
  const { buildSubscribeMessage } = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.DIRECT_MESSAGE, channelId: null });

  const { send, isConnected, connectWebSocket, disconnectWebSocket, listenersRef, sendRef, pendingReadCallbacksRef, removePendingPublish } =
    useWebSocketCore({ WS_URL, loginUserId, queryClient, buildSubscribeMessage });

  useEffect(() => { routerRef.current = router; });

  const addListener = useCallback((id: string, listener: Listener) => { listenersRef.current[id] = listener; }, [listenersRef]);
  const removeListener = useCallback((id: string) => { delete listenersRef.current[id]; }, [listenersRef]);

  useElectronNotification({ routerRef, sendRef, pendingReadCallbacksRef });

  useEffect(() => {
    const userId = useAuthStore.getState().user?.id;
    if (!WS_URL || !userId) return;
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [WS_URL, disconnectWebSocket, connectWebSocket]);

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
          send({ operationType: WS_OPERATION.SUB, channelType: type, channelId: room.roomModel.roomId, payload: null });
        });
      });

      queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, queryClient, send]);

  const value: WebSocketContextValue = { send, addListener, removeListener, isConnected, removePendingPublish };
  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useAppWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useAppWebSocket must be used within WebSocketProvider');
  return ctx;
};

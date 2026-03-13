import type { MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Listener } from '../type';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';

export interface MessageHandlerDeps {
  queryClient: QueryClient;
  listenersRef: MutableRefObject<Record<string, Listener>>;
  processedReadEventsRef: MutableRefObject<Set<string>>;
  pendingReadCallbacksRef: MutableRefObject<Map<string, () => void>>;
  sendRef: MutableRefObject<(data: unknown) => void>;
  isElectronRef: MutableRefObject<boolean>;
  loginUserId: string | undefined;
  buildSubscribeMessage: (opts: {
    channelIdOverride?: string;
    channelTypeOverride?: string;
  }) => unknown;
}

export function getTargetQueryKey(channelType: WebSocketChannelTypes | undefined) {
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
}

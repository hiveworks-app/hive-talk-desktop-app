import type {
  WebSocketChannelTypes,
  WebSocketEnvelope,
  WS_MESSAGE_CONTENT_TYPE,
} from '@/shared/types/websocket';

// ─── WebSocketContext ───

export type Listener = (data: WebSocketEnvelope) => void;

export interface WebSocketContextValue {
  send: (data: unknown) => void;
  addListener: (id: string, listener: Listener) => void;
  removeListener: (id: string) => void;
  isConnected: boolean;
  removePendingPublish: (content: string) => void;
}

// ─── useWebSocketMessageBuilder ───

export interface WebSocketMessageBuilderProps {
  type: WebSocketChannelTypes;
  channelId: string | null;
}

export type BuildPublishMessageParams =
  | {
      channelIdOverride?: string;
      tagList?: string[];
      type: typeof WS_MESSAGE_CONTENT_TYPE.TEXT;
      content: string;
    }
  | {
      channelIdOverride?: string;
      tagList?: string[];
      type:
        | typeof WS_MESSAGE_CONTENT_TYPE.IMAGE
        | typeof WS_MESSAGE_CONTENT_TYPE.MEDIA
        | typeof WS_MESSAGE_CONTENT_TYPE.FILE;
      fileId?: string;
      items: {
        path: string;
        meta: {
          thumbnail?: string;
          type: string;
          size: number;
        };
      }[];
    };

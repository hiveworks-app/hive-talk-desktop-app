import type {
  WebSocketOperationTypes,
  WebSocketChannelTypes,
} from './constants';
import type {
  WebSocketReceiveMessageProps,
  WebSocketReceiveSenderProps,
  WebSocketReceiveTagProps,
  WebSocketReceiveReadItemProps,
} from './message';

export interface WebSocketSendMessageProps<TPayload> {
  operationType: WebSocketOperationTypes;
  channelType: WebSocketChannelTypes;
  channelId: string;
  payload: TPayload;
}

export interface WebSocketReceiveSessionResponseProps<TPayload> {
  success: boolean;
  code: string;
  message: string;
  operationType: WebSocketOperationTypes;
  payload: TPayload;
}

export interface WebSocketReceiveBroadCastResponseProps<TPayload> {
  channelType: WebSocketChannelTypes;
  listenType: WebSocketOperationTypes;
  payload: TPayload;
}

export interface WebSocketSessionProps<TPayload> {
  socketResponseType: string;
  response: WebSocketReceiveSessionResponseProps<TPayload>;
}

export interface WebSocketBroadcastProps<TPayload> {
  socketResponseType: string;
  response: WebSocketReceiveBroadCastResponseProps<TPayload>;
}

export type WebSocketEnvelope = WebSocketSessionProps<unknown> | WebSocketBroadcastProps<unknown>;

export interface WebSocketPublishItem {
  message: WebSocketReceiveMessageProps;
  sender?: WebSocketReceiveSenderProps;
  tag: { items: WebSocketReceiveTagProps[] };
  readItems?: { items: WebSocketReceiveReadItemProps[] };
}

export type WebSocketHistoryPayload = WebSocketPublishItem[];
export type WebSocketSingleMessagePayload = WebSocketPublishItem;
export type WebSocketReadMessagePayload = { items: WebSocketReceiveReadItemProps[] };
export type WebSocketChatRoomExitPayload = { roomId: string; userId: string };

import type { TagListType } from '../tag';
import { WS_OPERATION, WS_RESPONSE_TYPE, WS_MESSAGE_CONTENT_TYPE } from './constants';
import type { SocketResponseTypeMeta, WebSocketOperationTypes, WebSocketChannelTypes } from './constants';
import type { WebSocketReceiveMessageProps, WebSocketMediaFileMessage } from './message';
import type {
  WebSocketEnvelope,
  WebSocketReceiveSessionResponseProps,
  WebSocketReceiveBroadCastResponseProps,
  WebSocketSessionProps,
  WebSocketBroadcastProps,
  WebSocketHistoryPayload,
  WebSocketSingleMessagePayload,
  WebSocketReadMessagePayload,
  WebSocketChatRoomExitPayload,
  WebSocketPublishItem,
} from './envelope';

export const parseSocketResponseType = (v: unknown): SocketResponseTypeMeta | null => {
  if (typeof v !== 'string') return null;
  const [responseType, operationType, channelType] = v.split('/');
  if (responseType !== WS_RESPONSE_TYPE.SESSION && responseType !== WS_RESPONSE_TYPE.BROADCAST) {
    return null;
  }
  return {
    responseType,
    operationType: operationType as WebSocketOperationTypes | undefined,
    channelType: channelType as WebSocketChannelTypes | undefined,
  };
};

const getSocketMeta = (data: { socketResponseType: unknown }) =>
  parseSocketResponseType(data.socketResponseType);

export const isSession = (
  data: WebSocketEnvelope,
): data is {
  socketResponseType: string;
  response: WebSocketReceiveSessionResponseProps<unknown>;
} => {
  const meta = getSocketMeta(data);
  return meta?.responseType === WS_RESPONSE_TYPE.SESSION;
};

export const isBroadcast = (
  data: WebSocketEnvelope,
): data is {
  socketResponseType: string;
  response: WebSocketReceiveBroadCastResponseProps<unknown>;
} => {
  const meta = getSocketMeta(data);
  return meta?.responseType === WS_RESPONSE_TYPE.BROADCAST;
};

export function isRoomInvite(data: WebSocketEnvelope): data is {
  socketResponseType: string;
  response: WebSocketReceiveBroadCastResponseProps<string>;
} {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  if (meta.operationType !== WS_OPERATION.INVITE) return false;
  const res = data.response as WebSocketReceiveBroadCastResponseProps<unknown>;
  return typeof res.payload === 'string';
}

export function isFetchMessage(data: WebSocketEnvelope): data is {
  socketResponseType: string;
  response: WebSocketReceiveSessionResponseProps<WebSocketHistoryPayload>;
} {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.FETCH_MESSAGE;
}

export function isFetchBeforeMessage(data: WebSocketEnvelope): data is {
  socketResponseType: string;
  response: WebSocketReceiveSessionResponseProps<WebSocketHistoryPayload>;
} {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.FETCH_MESSAGE_BEFORE;
}

export function isFetchAfterMessage(data: WebSocketEnvelope): data is {
  socketResponseType: string;
  response: WebSocketReceiveSessionResponseProps<WebSocketHistoryPayload>;
} {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.FETCH_MESSAGE_AFTER;
}

export function isPublish(data: WebSocketEnvelope): data is {
  socketResponseType: string;
  response: WebSocketReceiveBroadCastResponseProps<WebSocketSingleMessagePayload>;
} {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.PUB;
}

export function isSub(data: WebSocketEnvelope): boolean {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.SUB;
}

export function isReadMessage(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<WebSocketReadMessagePayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.READ_MESSAGE;
}

export function isViewInMessage(data: WebSocketEnvelope): data is WebSocketSessionProps<unknown> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.VIEW_IN_MESSAGE_ROOM;
}

export function isViewOutMessage(data: WebSocketEnvelope): data is WebSocketSessionProps<unknown> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.VIEW_OUT_MESSAGE_ROOM;
}

export function isAddTagSession(data: WebSocketEnvelope): boolean {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.ADD_TAG;
}

export function isRemoveTagSession(data: WebSocketEnvelope): boolean {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.REMOVE_TAG;
}

export function isAddTagBroadcast(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<{ items: TagListType[] }> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.ADD_TAG;
}

export function isRemoveTagBroadcast(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<{ items: TagListType[] }> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.REMOVE_TAG;
}

export const isMediaFileMessage = (
  msg: WebSocketReceiveMessageProps,
): msg is WebSocketMediaFileMessage => {
  return (
    msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
    msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
    msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE
  );
};

export function isDeleteMessage(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<WebSocketPublishItem> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.DELETE_MESSAGE;
}

export function isExitMessageRoomSession(
  data: WebSocketEnvelope,
): data is WebSocketSessionProps<WebSocketChatRoomExitPayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.EXIT_MESSAGE_ROOM;
}

export function isExitMessageRoomBroadcast(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<WebSocketChatRoomExitPayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.EXIT_MESSAGE_ROOM;
}

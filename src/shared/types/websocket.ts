// 100% 복사 - RN 의존성 없음
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { MemberItem } from '@/shared/types/user';
import { TagListType } from './tag';

interface BaseMetaProps {
  type: string;
  size: number;
}

export interface ReceiveFileItem {
  path: string;
  meta: BaseMetaProps;
  presignedUrl?: string;
}
export interface MessageFileItem extends ReceiveFileItem {
  meta: BaseMetaProps & {
    thumbnail: string;
    thumbnailPresignedUrl: string;
  };
}

export type LocalSendStatus = 'uploading' | 'uploaded' | 'publishing' | 'sent' | 'failed';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  name: string;
  time: string;
  createdAt: string;
  tags?: TagListType[];
  readUserIds: string[];
  notReadCount: number;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  messageContentType: WebSocketMessageType;
  files?: MessageFileItem[];
  isDeleted?: boolean;
}

export type ChatMessageUI = Message & {
  fileId?: string;
  isLocal?: boolean;
  localStatus?: LocalSendStatus;
  localUris?: string[];
  dimmed?: boolean;
};

export const WS_OPERATION = {
  SUB: 'SUB',
  INVITE: 'INVITE',
  VIEW_IN_MESSAGE_ROOM: 'VIEW_IN_MESSAGE_ROOM',
  VIEW_OUT_MESSAGE_ROOM: 'VIEW_OUT_MESSAGE_ROOM',
  FETCH_MESSAGE: 'FETCH_MESSAGE',
  FETCH_MESSAGE_AFTER: 'FETCH_MESSAGE_AFTER',
  FETCH_MESSAGE_BEFORE: 'FETCH_MESSAGE_BEFORE',
  PUB: 'PUB',
  DELETE_MESSAGE: 'DELETE_MESSAGE',
  READ_MESSAGE: 'READ_MESSAGE',
  ADD_TAG: 'ADD_TAG',
  REMOVE_TAG: 'REMOVE_TAG',
  EXIT_MESSAGE_ROOM: 'EXIT_MESSAGE_ROOM',
} as const;

export const WS_CHNANNEL_URL_TYPE = {
  DM_CHANNEL_URL: 'dm',
  GM_CHANNEL_URL: 'gm',
  EM_CHANNEL_URL: 'em',
} as const;

export const WS_CHANNEL_TYPE = {
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
  GROUP_MESSAGE: 'GROUP_MESSAGE',
  EXTERNAL_MESSAGE: 'EXTERNAL_MESSAGE',
} as const;

export const WS_RESPONSE_TYPE = {
  SESSION: 'SESSION',
  BROADCAST: 'BROADCAST',
} as const;

export const WS_MESSAGE_CONTENT_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  MEDIA: 'MEDIA',
  FILE: 'FILE',
  SUBMIT_INVITE: 'SUBMIT_INVITE',
  SUBMIT_EXIT: 'SUBMIT_EXIT',
} as const;

export type WebSocketOperationTypes = (typeof WS_OPERATION)[keyof typeof WS_OPERATION];
export type WebSocketChannelUrlTypes =
  (typeof WS_CHNANNEL_URL_TYPE)[keyof typeof WS_CHNANNEL_URL_TYPE];
export type WebSocketChannelTypes = (typeof WS_CHANNEL_TYPE)[keyof typeof WS_CHANNEL_TYPE];
export type WebSocketResponseTypes = (typeof WS_RESPONSE_TYPE)[keyof typeof WS_RESPONSE_TYPE];

export type SocketResponseTypeMeta = {
  responseType: WebSocketResponseTypes;
  operationType?: WebSocketOperationTypes;
  channelType?: WebSocketChannelTypes;
};

export type WebSocketMessageType =
  (typeof WS_MESSAGE_CONTENT_TYPE)[keyof typeof WS_MESSAGE_CONTENT_TYPE];

export interface WebSocketSendMessageProps<TPayload> {
  operationType: WebSocketOperationTypes;
  channelType: WebSocketChannelTypes;
  channelId: string;
  payload: TPayload;
}

interface WebSocketMessageBase {
  id: string;
  roomId: string;
  companyId: string;
  channelId: string;
  senderId: string;
  messageContentType: WebSocketMessageType;
  createdAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  ts: string;
  version: string;
}

export interface WebSocketTextMessage extends WebSocketMessageBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.TEXT;
  payload: { content: string };
}

export interface WebSocketMediaFileMessageItemsProps {
  fileId?: string | null | undefined;
  items: MessageFileItem[];
}

export interface WebSocketMediaFileMessage extends WebSocketMessageBase {
  messageContentType:
    | typeof WS_MESSAGE_CONTENT_TYPE.IMAGE
    | typeof WS_MESSAGE_CONTENT_TYPE.MEDIA
    | typeof WS_MESSAGE_CONTENT_TYPE.FILE;
  payload: WebSocketMediaFileMessageItemsProps;
}

export interface WebSocketSubmitInvitePayload {
  userList: ParticipantItemsType[];
}

export type WebSocketSubmitExitPayload = null;

export interface WebSocketSubmitInviteMessage extends WebSocketMessageBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE;
  payload: WebSocketSubmitInvitePayload;
}

export interface WebSocketSubmitExitMessage extends WebSocketMessageBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;
  payload: WebSocketSubmitExitPayload;
}

export type WebSocketReceiveMessageProps =
  | WebSocketTextMessage
  | WebSocketMediaFileMessage
  | WebSocketSubmitInviteMessage
  | WebSocketSubmitExitMessage;

export type WebSocketReceiveSenderProps = MemberItem;
export type WebSocketReceiveTagProps = TagListType;

export interface WebSocketReceiveReadItemProps {
  roomId: string;
  messageId: string;
  userId: string;
  readAt: Date;
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

export interface InviteMessageProps {
  inviteUserId?: string;
  inviteUserIdArray?: string[];
  channelIdOverride?: string;
}

export interface SubscribeMessageProps {
  channelIdOverride?: string;
  channelTypeOverride?: string;
}

export interface ViewInRoomMessageProps {
  channelIdOverride?: string;
}

export interface ExitMessageRoomProps {
  channelIdOverride?: string;
}

export interface FetchMessageProps {
  currentMessage: string;
  isInclusive?: boolean;
  channelIdOverride?: string;
}

export interface PublishMessageProps {
  tagList: string[];
  content: string;
  channelIdOverride?: string;
}

export interface DeleteMessageProps {
  messageId: string;
}

export interface UpdateTagToMessageProps {
  messageId: string;
  tagIdList: string[];
}

export interface RemoveTagMessageProps {
  messageId: string;
  taggingIdList: string[];
}

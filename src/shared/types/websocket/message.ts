import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { MemberItem } from '@/shared/types/user';
import type { TagListType } from '../tag';
import { WS_MESSAGE_CONTENT_TYPE } from './constants';
import type { WebSocketMessageType } from './constants';

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

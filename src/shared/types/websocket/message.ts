import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { MemberItem } from '@/shared/types/user';
import type { TagListType } from '../tag';
import { WS_MESSAGE_CONTENT_TYPE } from './constants';
import type { WebSocketMessageType } from './constants';

interface BaseMetaProps {
  type: string;
  size: number;
  duration?: number;
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
  /** 발신자 userId — 차단/탈퇴 사용자 판별용 (로컬 생성 메시지는 생략 가능) */
  senderId?: string;
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
  retryPayload?: { content: string; tagList: string[]; roomId: string };
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
  /**
   * 신고 접수(운영자 승인 전) 마스킹 플래그 — 신고자 본인 FETCH/last-message 응답에서
   * payload.content가 이미 마스킹 문구로 교체되어 온다 (RN 2026-07-08 서버 구현 실측).
   */
  isReported?: boolean;
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

/** 방 제목 변경 브로드캐스트 — payload.content가 변경된 새 제목 (RN 패리티) */
export interface WebSocketSubmitRoomTitleUpdatePayload {
  fileId: string | null;
  content: string;
}

export interface WebSocketSubmitRoomTitleUpdateMessage extends WebSocketMessageBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE;
  payload: WebSocketSubmitRoomTitleUpdatePayload;
}

/** 공지 등록/구 제목변경 시스템 안내 (RN 패리티) */
export interface WebSocketSubmitNoticeMessage extends WebSocketMessageBase {
  messageContentType:
    | typeof WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE
    | typeof WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE;
  payload: { content?: string } | null;
}

/** 신고 접수(신고자 본인) 마스킹 — content가 서버 마스킹 문구 */
export interface WebSocketReportedMaskMessage extends WebSocketMessageBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK;
  payload: { content: string };
}

export type WebSocketReceiveMessageProps =
  | WebSocketTextMessage
  | WebSocketMediaFileMessage
  | WebSocketSubmitInviteMessage
  | WebSocketSubmitExitMessage
  | WebSocketSubmitRoomTitleUpdateMessage
  | WebSocketSubmitNoticeMessage
  | WebSocketReportedMaskMessage;

// 🔷 Response `보낸사람` 구조
// isDeleted: 탈퇴 사용자 플래그 — 서버는 히스토리/PUB sender의 이름을 원본으로 유지한 채
// 이 플래그만 내려주며(RN 2026-07-21 실측), "알 수 없음" + 기본 이미지 표시 익명화는 클라 책임.
export type WebSocketReceiveSenderProps = MemberItem & { isDeleted?: boolean };
export type WebSocketReceiveTagProps = TagListType;

export interface WebSocketReceiveReadItemProps {
  roomId: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

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
/** REPORTED(신고 접수 마스킹) broadcast payload — content는 마스킹 대체 문구 */
export type WebSocketReportedMessagePayload = { roomId: string; messageId: string; content: string };
/** REPORT_HIDDEN(신고 확정 숨김) broadcast payload — content는 시스템 안내 문구 */
export type WebSocketReportHiddenPayload = { roomId: string; messageId: string; messageContentType: string; content: string };
/**
 * 차단 동기화 raw 사용자 모델 (RN FetchUserRawModel 패리티).
 * 서버 직렬화에 따라 모든 ID가 string으로 올 수 있고 필드가 가변이라 전부 optional 방어.
 */
export interface FetchUserRawModel {
  userId: string | number;
  isBlocked?: boolean;
  companyId?: string | number | null;
  companyName?: string;
  ceoName?: string;
  code?: string;
  brn?: string;
  email?: string;
  name?: string;
  department?: string | null;
  job?: string | null;
  phoneHead?: string;
  phoneMid?: string;
  phoneTail?: string;
  role?: string;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
  profilePresignedUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  thumbnailProfilePresignedUrl?: string | null;
  isExternal?: boolean;
}

/**
 * INIT/USER/BLOCK_SYNC payload — 오프라인 동안 누적된 차단/해제 델타.
 * 서버 보장: net-zero 제외 · 유저별 최종 상태만 · 소비 1회 · 변경 없으면 프레임 미발행.
 */
export interface BlockSyncInitPayload {
  blocked: FetchUserRawModel[];
  unblocked: FetchUserRawModel[];
}

/**
 * {BROADCAST|INIT}/MEMBER_REMOVED/DIRECT_MESSAGE payload — 방 스코프 멤버 제거.
 * 회원탈퇴/소속해제 모두 동일 이벤트로 온다(RN 실측 — 소켓 레벨 구분 불가).
 * removedUserId는 string/number 혼재 → String() 정규화 필수.
 */
export interface DmMemberRemovedPayload {
  removedUserId: string | number;
  roomId: string;
}

/** {BROADCAST|INIT}/COMPANY/MEMBER_REMOVED payload — 전역 스코프 사내멤버 제거 */
export interface CompanyMemberRemovedPayload {
  removedUserId: string | number;
}

/** INIT/INVITE/EXTERNAL — 최초 연결 시 외부(협력) 초대 수신 건수 (RN 패리티) */
export interface ExternalInviteInitPayload {
  receivedCount: string | number;
}

/** BROADCAST/INVITE/EXTERNAL — 외부 초대 실시간 수신 (PENDING) / 거절(REJECTED) */
export interface ExternalInviteBroadcastPayload {
  inviteId?: string;
  user: {
    userId: string;
    name: string;
    companyId?: string | null;
    companyName?: string | null;
    profileUrl?: string | null;
  };
  result: string;
}

/** {INIT|BROADCAST}/EXTERNAL/INVITE_ACCEPTED — 협력멤버 수락 완료 */
export interface ExternalInviteAcceptedPayload {
  inviteId?: number | string;
  user: {
    userId: string | number;
    name: string;
    companyName?: string | null;
    department?: string | null;
    job?: string | null;
    profilePresignedUrl?: string | null;
    /** 신규 멤버 24h 판정 필드 — INIT 경로는 null 가능 (RN 실측), MEMBERS refetch가 실값 보강 */
    joinedAt?: string | null;
    contactedAt?: string | null;
  };
}

/** BROADCAST/EXTERNAL/INVITE_CANCELLED — PENDING 초대 취소/당사자 탈퇴 (양측 silent) */
export interface ExternalInviteCancelledPayload {
  otherUserId: string;
}

/** {INIT|BROADCAST}/EXTERNAL/CONTACT_DELETED — 협력멤버 삭제 (양방향 silent) */
export interface ExternalContactDeletedPayload {
  removedUserId: string | number;
}

/** BROADCAST/COMPANY/MEMBER_DISMISSED — 소속 해제 (dismissedUserId는 number 가능, String() 정규화 필수) */
export interface MemberDismissedPayload {
  companyId: string | number;
  dismissedUserId: string | number;
}

/** PROFILE/UPDATED(프로필 변경 실시간) broadcast payload */
export interface ProfileUpdatedPayload {
  userId: string;
  name: string;
  department: string | null;
  job: string | null;
  email?: string;
  profileUrl: string | null;
  profilePresignedUrl?: string | null;
  thumbnailProfileUrl: string | null;
  thumbnailProfilePresignedUrl?: string | null;
  companyName?: string;
  companyId?: string;
  role?: string;
  isExternal?: boolean;
}

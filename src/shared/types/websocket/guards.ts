import type { TagListType } from '../tag';
import { WS_OPERATION, WS_RESPONSE_TYPE, WS_MESSAGE_CONTENT_TYPE, WS_ACCOUNT_EVENT } from './constants';
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
  WebSocketReportedMessagePayload,
  WebSocketReportHiddenPayload,
  ProfileUpdatedPayload,
  WebSocketPublishItem,
  FetchUserRawModel,
  BlockSyncInitPayload,
  DmMemberRemovedPayload,
  CompanyMemberRemovedPayload,
  ExternalInviteInitPayload,
  ExternalInviteBroadcastPayload,
  ExternalInviteAcceptedPayload,
  ExternalInviteCancelledPayload,
  ExternalContactDeletedPayload,
  MemberDismissedPayload,
} from './envelope';
import type { AccountSuspendedBroadcastPayload } from '../account';
import type { MemberInvitePayload } from '@/features/member-invite/type';

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

// 🎲 BROADCAST ACCOUNT/SUSPENDED (실시간 계정 정지) 판별
export function isBroadcastAccountSuspended(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<AccountSuspendedBroadcastPayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  if (meta.operationType !== WS_OPERATION.ACCOUNT) return false;
  // channelType 슬롯에 SUSPENDED가 실린다 (chat 채널 타입과 무관한 값이라 string 비교)
  if ((meta.channelType as string | undefined) !== WS_ACCOUNT_EVENT.SUSPENDED) return false;

  const res = data.response as WebSocketReceiveBroadCastResponseProps<unknown>;
  return typeof res.payload === 'object' && res.payload !== null;
}

// 🎲 REPORTED(신고 접수된 메시지 마스킹) BROADCAST 판별
export function isReportedMessageBroadcast(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<WebSocketReportedMessagePayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.REPORTED;
}

// 🎲 REPORT_HIDDEN(신고 확정 숨김) BROADCAST 판별
export function isReportHiddenBroadcast(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<WebSocketReportHiddenPayload> {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.BROADCAST) return false;
  return meta.operationType === WS_OPERATION.REPORT_HIDDEN;
}

// 🎲 BROADCAST/PROFILE/UPDATED (프로필 변경 실시간 수신) 판별
export function isBroadcastProfileUpdated(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ProfileUpdatedPayload> {
  return typeof data.socketResponseType === 'string' && data.socketResponseType === 'BROADCAST/PROFILE/UPDATED';
}

// 🎲 메시지 삭제 SESSION 실패 응답인지 체크 (예: 24시간 초과 DM006)
// 성공 삭제는 BROADCAST/DELETE_MESSAGE(isDeleteMessage)로 오지만, 서버가 삭제를 거절할 때는
// SESSION/DELETE_MESSAGE + success:false 로 응답한다(요청자 본인에게만). 이 경우 서버가 준
// message를 그대로 토스트로 노출한다 (RN 패리티)
export const isDeleteMessageSessionFailure = (
  data: WebSocketEnvelope,
): data is WebSocketSessionProps<null> => {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  if (meta.operationType !== WS_OPERATION.DELETE_MESSAGE) return false;
  const { response } = data as WebSocketSessionProps<unknown>;
  return !!response && response.success === false;
};

// 🔌 SESSION/DISCONNECT — 서버 세션 강제 종료 판별 (현재 유일한 발행 사유: 중복 로그인 SC010).
// code별 분기가 필요해지면 response.code 를 참조한다 (RN 패리티)
export const isSessionDisconnect = (
  data: WebSocketEnvelope,
): data is WebSocketSessionProps<null> => {
  const meta = getSocketMeta(data);
  if (!meta || meta.responseType !== WS_RESPONSE_TYPE.SESSION) return false;
  return meta.operationType === WS_OPERATION.DISCONNECT;
};

// 🚫 BROADCAST/USER/BLOCKED — 차단자 본인의 모든 디바이스에 단건 전달 (RN 패리티)
export function isBroadcastUserBlocked(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<FetchUserRawModel> {
  return data.socketResponseType === 'BROADCAST/USER/BLOCKED';
}

// 🚫 BROADCAST/USER/UNBLOCKED — 차단 해제 단건 (실질 userId만 유효)
export function isBroadcastUserUnblocked(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<FetchUserRawModel> {
  return data.socketResponseType === 'BROADCAST/USER/UNBLOCKED';
}

// 🚫 INIT/USER/BLOCK_SYNC — 재연결 시 오프라인 누적 차단/해제 델타 (소비 1회)
export function isInitBlockSync(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<BlockSyncInitPayload> {
  return data.socketResponseType === 'INIT/USER/BLOCK_SYNC';
}

// 🏢 사내(소속) 초대/합류/해제 이벤트 (RN 패리티)
export function isBroadcastMemberInvite(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<MemberInvitePayload> {
  if (data.socketResponseType !== 'BROADCAST/INVITE/MEMBER_INVITE') return false;
  const res = data.response as { payload?: unknown };
  return typeof res?.payload === 'object' && res.payload !== null;
}
export function isInitMemberInvite(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<MemberInvitePayload[]> {
  if (data.socketResponseType !== 'INIT/INVITE/MEMBER_INVITE') return false;
  const res = data.response as { payload?: unknown };
  return Array.isArray(res?.payload);
}
export function isBroadcastMemberJoined(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<unknown> {
  return data.socketResponseType === 'BROADCAST/COMPANY/MEMBER_JOINED';
}
export function isInitMemberJoined(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<unknown> {
  return data.socketResponseType === 'INIT/COMPANY/MEMBER_JOINED';
}
export function isBroadcastMemberDismissed(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<MemberDismissedPayload> {
  return data.socketResponseType === 'BROADCAST/COMPANY/MEMBER_DISMISSED';
}

// 📩 외부(협력멤버) 초대 이벤트 — 실시간(BROADCAST) + 재연결 보강(INIT) 쌍 (RN 패리티)
export function isInitExternalInvite(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalInviteInitPayload> {
  if (data.socketResponseType !== 'INIT/INVITE/EXTERNAL') return false;
  const res = data.response as { payload?: unknown };
  return typeof res?.payload === 'object' && res.payload !== null && 'receivedCount' in res.payload;
}
export function isBroadcastExternalInvite(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalInviteBroadcastPayload> {
  if (data.socketResponseType !== 'BROADCAST/INVITE/EXTERNAL') return false;
  const res = data.response as { payload?: unknown };
  return typeof res?.payload === 'object' && res.payload !== null && 'user' in res.payload;
}
export function isInitExternalInviteAccepted(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalInviteAcceptedPayload> {
  return data.socketResponseType === 'INIT/EXTERNAL/INVITE_ACCEPTED';
}
export function isBroadcastExternalInviteAccepted(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalInviteAcceptedPayload> {
  return data.socketResponseType === 'BROADCAST/EXTERNAL/INVITE_ACCEPTED';
}
export function isBroadcastExternalInviteCancelled(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalInviteCancelledPayload> {
  return data.socketResponseType === 'BROADCAST/EXTERNAL/INVITE_CANCELLED';
}
export function isBroadcastExternalContactDeleted(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalContactDeletedPayload> {
  return data.socketResponseType === 'BROADCAST/EXTERNAL/CONTACT_DELETED';
}
export function isInitExternalContactDeleted(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ExternalContactDeletedPayload> {
  return data.socketResponseType === 'INIT/EXTERNAL/CONTACT_DELETED';
}

// 👋 방 스코프 멤버 제거 (회원탈퇴·소속해제) — BROADCAST(실시간) + INIT(재연결 보강) 쌍 (RN 패리티)
export function isBroadcastDmMemberRemoved(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<DmMemberRemovedPayload> {
  return data.socketResponseType === 'BROADCAST/MEMBER_REMOVED/DIRECT_MESSAGE';
}
export function isInitDmMemberRemoved(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<DmMemberRemovedPayload> {
  return data.socketResponseType === 'INIT/MEMBER_REMOVED/DIRECT_MESSAGE';
}

// 👋 전역 스코프 사내멤버 제거 — 멤버 목록 정리용
export function isBroadcastCompanyMemberRemoved(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<CompanyMemberRemovedPayload> {
  return data.socketResponseType === 'BROADCAST/COMPANY/MEMBER_REMOVED';
}
export function isInitCompanyMemberRemoved(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<CompanyMemberRemovedPayload> {
  return data.socketResponseType === 'INIT/COMPANY/MEMBER_REMOVED';
}

// 👤 INIT/PROFILE/UPDATED — 재연결 보강 프로필 변경 (BROADCAST 핸들러 재사용)
export function isInitProfileUpdated(
  data: WebSocketEnvelope,
): data is WebSocketBroadcastProps<ProfileUpdatedPayload> {
  return data.socketResponseType === 'INIT/PROFILE/UPDATED';
}

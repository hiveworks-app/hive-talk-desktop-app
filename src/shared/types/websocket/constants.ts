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
  REPORTED: 'REPORTED', // 신고 접수된 메시지 마스킹 (신고자 본인 접속 기기 전체)
  REPORT_HIDDEN: 'REPORT_HIDDEN', // 신고 확정(운영 숨김) — 방 참여자 전체 시스템 안내 대체
  READ_MESSAGE: 'READ_MESSAGE',
  ADD_TAG: 'ADD_TAG',
  REMOVE_TAG: 'REMOVE_TAG',
  EXIT_MESSAGE_ROOM: 'EXIT_MESSAGE_ROOM',
  ACCOUNT: 'ACCOUNT', // 계정 관련 이벤트 (정지 등)
} as const;

/** 계정 이벤트 하위 타입 — socketResponseType의 channelType 슬롯에 실린다 */
export const WS_ACCOUNT_EVENT = {
  SUSPENDED: 'SUSPENDED',
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
  SUBMIT_ROOM_TITLE_UPDATE: 'SUBMIT_ROOM_TITLE_UPDATE', // 방 제목 변경 시스템 안내 (payload.content = 새 제목)
  SYSTEM_REPORTED: 'SYSTEM_REPORTED', // 신고 확정 시 메시지를 대체하는 시스템 안내
} as const;

export type WebSocketOperationTypes = (typeof WS_OPERATION)[keyof typeof WS_OPERATION];
export type WebSocketChannelUrlTypes =
  (typeof WS_CHNANNEL_URL_TYPE)[keyof typeof WS_CHNANNEL_URL_TYPE];
export type WebSocketChannelTypes = (typeof WS_CHANNEL_TYPE)[keyof typeof WS_CHANNEL_TYPE];
export type WebSocketResponseTypes = (typeof WS_RESPONSE_TYPE)[keyof typeof WS_RESPONSE_TYPE];
export type WebSocketMessageType =
  (typeof WS_MESSAGE_CONTENT_TYPE)[keyof typeof WS_MESSAGE_CONTENT_TYPE];

export type SocketResponseTypeMeta = {
  responseType: WebSocketResponseTypes;
  operationType?: WebSocketOperationTypes;
  channelType?: WebSocketChannelTypes;
};

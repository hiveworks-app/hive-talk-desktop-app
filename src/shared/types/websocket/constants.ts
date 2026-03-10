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
export type WebSocketMessageType =
  (typeof WS_MESSAGE_CONTENT_TYPE)[keyof typeof WS_MESSAGE_CONTENT_TYPE];

export type SocketResponseTypeMeta = {
  responseType: WebSocketResponseTypes;
  operationType?: WebSocketOperationTypes;
  channelType?: WebSocketChannelTypes;
};

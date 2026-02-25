import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';

export const SIGNUP_TERMS_KEY = ['signupTerms'];
export const MEMBERS_KEY = ['members'];
export const TAG_CATEGORY_KEY = ['tagCategoryList'];
export const TAG_LIST_KEY = ['tagList'];
export const PRESIGNED_URL = (key: string) => ['presignedImage', key];
export const DM_CHECK_KEY = ['dmCheck'];
export const DM_ROOM_LIST_KEY = ['dmRoomList'];
export const GM_ROOM_LIST_KEY = ['gmRoomList'];
export const EM_ROOM_LIST_KEY = ['emRoomList'];
export const DM_LAST_MESSAGE_KEY = (roomId: string) => ['dm', 'last-message', roomId];
export const GM_LAST_MESSAGE_KEY = (roomId: string) => ['gm', 'last-message', roomId];
export const EM_LAST_MESSAGE_KEY = (roomId: string) => ['em', 'last-message', roomId];
export const MY_ORGANIZATION_KEY = ['myOrganization'];
export const ORGANIZATION_MEMBERS_KEY = (search?: string) => ['organizationMembers', search ?? ''];
export const DEPARTMENTS_KEY = ['departments'];
export const EXTERNAL_MEMBERS_KEY = (search?: string) => ['externalMembers', search ?? ''];

export const ROOM_BEFORE_ATTACHMENT_KEY = (
  roomId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) => [channelType, 'attachment', roomId];
export const DM_BEFORE_ATTACHMENT_KEY = (roomId: string) =>
  ROOM_BEFORE_ATTACHMENT_KEY(roomId, WS_CHANNEL_TYPE.DIRECT_MESSAGE);

export const ROOM_BEFORE_FILE_KEY = (
  roomId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) => [channelType, 'file', roomId];
export const DM_BEFORE_FILE_KEY = (roomId: string) =>
  ROOM_BEFORE_FILE_KEY(roomId, WS_CHANNEL_TYPE.DIRECT_MESSAGE);

export const ROOM_PARTICIPANTS_KEY = (
  roomId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) => [channelType, 'participants', roomId];

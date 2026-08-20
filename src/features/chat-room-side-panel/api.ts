import {
  FileSenderRoomType,
  GetFileSendersParams,
  GetFileSendersResponse,
  GetFilesParams,
  GetFilesResponse,
  GetSidePanelAttachmentsProps,
  GetSidePanelAttachmentsResponse,
  GetSidePanelParticipantsResponse,
} from '@/features/chat-room-side-panel/type';
import { request } from '@/shared/api';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { getChannelUrl } from '@/shared/utils/websocketUtils';

/**
 * 채팅방 ID 기준 이전 사진/동영상 불러오기
 */
export const apiGetBeforeSidePanelAttachment = ({
  roomId,
  lastMessageId,
  messageContentType,
  beforeCount = 10,
  channelType = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
}: GetSidePanelAttachmentsProps & { beforeCount?: number }) => {
  const isInclusive = true;
  const messageContentTypeQuery = messageContentType
    .map(type => `messageContentType=${type}`)
    .join('&');
  const query = `?isInclusive=${isInclusive}&beforeCount=${beforeCount}&lastMessageId=${lastMessageId}&${messageContentTypeQuery}`;
  const prefix = '/app/' + getChannelUrl(channelType);
  return request<GetSidePanelAttachmentsResponse>(`${prefix}/${roomId}/messages/before${query}`, {
    method: 'GET',
  });
};

/**
 * 채팅방 ID 기준 이전 파일 불러오기
 */
export const apiGetBeforeSidePanelFile = ({
  roomId,
  lastMessageId,
  messageContentType,
  beforeCount = 50,
  channelType = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
}: GetSidePanelAttachmentsProps & { beforeCount?: number }) => {
  const isInclusive = true;
  const messageContentTypeQuery = messageContentType
    .map(type => `messageContentType=${type}`)
    .join('&');
  const query = `?isInclusive=${isInclusive}&beforeCount=${beforeCount}&lastMessageId=${lastMessageId}&${messageContentTypeQuery}`;
  const prefix = '/app/' + getChannelUrl(channelType);
  return request<GetSidePanelAttachmentsResponse>(`${prefix}/${roomId}/messages/before${query}`, {
    method: 'GET',
  });
};

/**
 * 채팅방 ID 기준 참여자 목록 불러오기
 */
export const apiGetSidePanelParticipants = (roomId: string, channelType: WebSocketChannelTypes) => {
  const prefix = '/app/' + getChannelUrl(channelType);
  return request<GetSidePanelParticipantsResponse>(`${prefix}/${roomId}/participants`, {
    method: 'GET',
  });
};

export const channelTypeToRoomType = (channelType: WebSocketChannelTypes): FileSenderRoomType => {
  switch (channelType) {
    case WS_CHANNEL_TYPE.GROUP_MESSAGE:
      return 'GM';
    case WS_CHANNEL_TYPE.EXTERNAL_MESSAGE:
      return 'EM';
    default:
      return 'DM';
  }
};

/**
 * GET /app/chat/files/senders (RN 패리티)
 * 해당 contentType의 파일을 보낸 유저를 이름 부분일치로 검색.
 * 범용/타입별/특정 방 모드 지원, 기간 필터 + 커서 페이지네이션.
 */
export const apiGetFileSenders = (params: GetFileSendersParams) => {
  const parts: string[] = [];
  const enc = encodeURIComponent;
  if (params.keyword) parts.push(`keyword=${enc(params.keyword)}`);
  params.contentType?.forEach(t => parts.push(`contentType=${enc(t)}`));
  if (params.roomType) parts.push(`roomType=${enc(params.roomType)}`);
  if (params.roomId) parts.push(`roomId=${enc(params.roomId)}`);
  if (params.from) parts.push(`from=${enc(params.from)}`);
  if (params.to) parts.push(`to=${enc(params.to)}`);
  if (params.lastName) parts.push(`lastName=${enc(params.lastName)}`);
  if (params.lastUserId) parts.push(`lastUserId=${enc(params.lastUserId)}`);
  if (typeof params.count === 'number') parts.push(`count=${params.count}`);

  const queryString = parts.join('&');
  return request<GetFileSendersResponse>(
    `/app/chat/files/senders${queryString ? `?${queryString}` : ''}`,
    { method: 'GET' },
  );
};

/**
 * GET /app/chat/files (RN 패리티)
 * DM/GM/EM 통합 또는 특정 방의 파일 메시지를 최신순 조회.
 * senders[], fileName, from/to, contentType, roomType+roomId 필터 지원. page-based(1-base).
 * 응답 pagination/totalFileSize는 서버가 string으로 내려주므로 number로 변환 후 반환.
 */
export const apiGetFiles = async (params: GetFilesParams) => {
  const parts: string[] = [];
  const enc = encodeURIComponent;
  params.contentType?.forEach(t => parts.push(`contentType=${enc(t)}`));
  if (params.roomType) parts.push(`roomType=${enc(params.roomType)}`);
  if (params.roomId) parts.push(`roomId=${enc(params.roomId)}`);
  // senders는 ?senders=1&senders=2 형태로 반복 전송
  params.senders?.forEach(id => parts.push(`senders=${enc(id)}`));
  if (params.fileName && params.fileName.trim()) {
    parts.push(`fileName=${enc(params.fileName)}`);
  }
  if (params.from) parts.push(`from=${enc(params.from)}`);
  if (params.to) parts.push(`to=${enc(params.to)}`);
  if (typeof params.page === 'number') parts.push(`page=${params.page}`);
  if (typeof params.size === 'number') parts.push(`size=${params.size}`);

  const queryString = parts.join('&');
  // 서버 raw 응답: pagination/totalFileSize가 string으로 내려옴 (예: "94", "1821205726")
  type RawPagination = {
    totalItems: string;
    totalPages: string;
    currentPage: string;
    perPage: string;
  };
  type RawGetFilesResponse = {
    items: GetFilesResponse['items'];
    pagination: RawPagination;
    totalFileSize: string;
  };
  const res = await request<RawGetFilesResponse>(
    `/app/chat/files${queryString ? `?${queryString}` : ''}`,
    { method: 'GET' },
  );
  const rawPagination = res.payload.pagination;
  const normalized: GetFilesResponse = {
    items: res.payload.items,
    pagination: {
      totalItems: Number(rawPagination?.totalItems ?? 0),
      totalPages: Number(rawPagination?.totalPages ?? 0),
      currentPage: Number(rawPagination?.currentPage ?? 1),
      perPage: Number(rawPagination?.perPage ?? 0),
    },
    totalFileSize: Number(res.payload.totalFileSize ?? 0),
  };
  return { ...res, payload: normalized };
};

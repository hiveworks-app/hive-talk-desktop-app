import {
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

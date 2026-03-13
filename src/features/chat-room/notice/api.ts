import { request } from '@/shared/api';
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { getChannelUrl } from '@/shared/utils/websocketUtils';
import type { NoticeDisplayRequest, NoticeModel, NoticeRequest } from './type';

const getNoticeUrl = (channelType: WebSocketChannelTypes, roomId: string) =>
  `/app/${getChannelUrl(channelType)}/${roomId}/notice`;

/** 공지사항 조회 */
export const apiGetNotice = (roomId: string, channelType: WebSocketChannelTypes) =>
  request<NoticeModel>(getNoticeUrl(channelType, roomId), { method: 'GET' });

/** 공지사항 생성 */
export const apiCreateNotice = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  body: NoticeRequest,
) => request<NoticeModel>(getNoticeUrl(channelType, roomId), { method: 'POST', body });

/** 공지사항 삭제 */
export const apiDeleteNotice = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  noticeId: number,
) => request<null>(`${getNoticeUrl(channelType, roomId)}/${noticeId}`, { method: 'DELETE' });

/** 공지사항 표시 상태 변경 (접기/펼치기) */
export const apiUpdateNoticeDisplay = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  noticeId: number,
  body: NoticeDisplayRequest,
) =>
  request<NoticeModel>(`${getNoticeUrl(channelType, roomId)}/${noticeId}/display`, {
    method: 'PUT',
    body,
  });

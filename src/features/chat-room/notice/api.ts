import { request } from '@/shared/api';
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { getChannelUrl } from '@/shared/utils/websocketUtils';
import type { LegacyNoticeModel, NoticeDisplayRequest, NoticeModel, NoticeRequest } from './type';

/**
 * 공지 base URL (v2) — v2는 공지 전용 버전업: 요청/응답이 {title, messageContentType, payload} 구조.
 * 메시지 path를 그대로 전달하면 서버가 `*_notice/` 경로로 자동 복제하므로
 * 원본 메시지 가리기/삭제와 공지 미디어가 물리적으로 분리된다. (RN 패리티)
 */
const getNoticeUrl = (channelType: WebSocketChannelTypes, roomId: string) =>
  `/app/v2/${getChannelUrl(channelType)}/${roomId}/notice`;

/** 공지사항 조회 — 공지가 없으면 payload가 null */
export const apiGetNotice = (roomId: string, channelType: WebSocketChannelTypes) =>
  request<NoticeModel | LegacyNoticeModel | null>(getNoticeUrl(channelType, roomId), { method: 'GET' });

/** 공지사항 생성 */
export const apiCreateNotice = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  body: NoticeRequest,
) => request<NoticeModel | LegacyNoticeModel>(getNoticeUrl(channelType, roomId), { method: 'POST', body });

/** 공지사항 수정 (등록자 본인만 가능) */
export const apiUpdateNotice = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  noticeId: number,
  body: NoticeRequest,
) => request<NoticeModel>(`${getNoticeUrl(channelType, roomId)}/${noticeId}`, { method: 'PUT', body });

/** 공지사항 삭제 */
export const apiDeleteNotice = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  noticeId: number,
) => request<null>(`${getNoticeUrl(channelType, roomId)}/${noticeId}`, { method: 'DELETE' });

/** 공지사항 표시 상태 변경 (접기/펼치기/다시 안보기) — v2 응답 payload 없음(Unit) */
export const apiUpdateNoticeDisplay = (
  roomId: string,
  channelType: WebSocketChannelTypes,
  noticeId: number,
  body: NoticeDisplayRequest,
) =>
  request<null>(`${getNoticeUrl(channelType, roomId)}/${noticeId}/display`, {
    method: 'PUT',
    body,
  });

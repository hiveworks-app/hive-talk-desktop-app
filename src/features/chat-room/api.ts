import {
  ChatFileUploadRequestProps,
  ChatFileUploadResponsePayload,
} from '@/features/chat-room/type';
import { request } from '@/shared/api';
import { WebSocketPublishItem } from '@/shared/types/websocket';

/* ==================== DM ==================== */

export const apiGetDMLastMessage = (roomId: string) =>
  request<WebSocketPublishItem>(`/app/dm/${roomId}/last-message`, {
    method: 'GET',
  });

export const apiDMFileUpload = (data: ChatFileUploadRequestProps) =>
  request<ChatFileUploadResponsePayload>(`/app/dm/file-upload/${data.fileName}`, {
    method: 'POST',
    body: data,
  });

/* ==================== GM ==================== */

export const apiGetGMLastMessage = (roomId: string) =>
  request<WebSocketPublishItem>(`/app/gm/${roomId}/last-message`, {
    method: 'GET',
  });

export const apiGMFileUpload = (data: ChatFileUploadRequestProps) =>
  request<ChatFileUploadResponsePayload>(`/app/gm/file-upload/${data.fileName}`, {
    method: 'POST',
    body: data,
  });

/** GM 채팅방 제목 변경 (1~50자) */
export const apiUpdateGMRoomTitle = (roomId: string, title: string) =>
  request<void>(`/app/gm/rooms/${roomId}/title`, { method: 'PUT', body: { title } });

/* ==================== EM ==================== */

export const apiGetEMLastMessage = (roomId: string) =>
  request<WebSocketPublishItem>(`/app/em/${roomId}/last-message`, {
    method: 'GET',
  });

export const apiEMFileUpload = (data: ChatFileUploadRequestProps) =>
  request<ChatFileUploadResponsePayload>(`/app/em/file-upload/${data.fileName}`, {
    method: 'POST',
    body: data,
  });

/** EM(협력) 채팅방 제목 변경 (1~50자) */
export const apiUpdateEMRoomTitle = (roomId: string, title: string) =>
  request<void>(`/app/em/rooms/${roomId}/title`, { method: 'PUT', body: { title } });

// ────────────────────────────────────────────────
// Active Dates — 캘린더에서 대화 있는 날짜만 활성화 (RN 패리티)
// ────────────────────────────────────────────────

export interface ActiveDateMonth {
  month: number;
  days: number[];
}

export interface ActiveDateYear {
  year: number;
  months: ActiveDateMonth[];
}

export interface ActiveDatesPayload {
  items: ActiveDateYear[];
}

/** DM 방 활동 날짜 조회 */
export const apiGetDMActiveDates = (roomId: string) =>
  request<ActiveDatesPayload>(`/app/dm/${roomId}/active-dates`, { method: 'GET' });

/** GM 방 활동 날짜 조회 */
export const apiGetGMActiveDates = (roomId: string) =>
  request<ActiveDatesPayload>(`/app/gm/${roomId}/active-dates`, { method: 'GET' });

/** EM 방 활동 날짜 조회 */
export const apiGetEMActiveDates = (roomId: string) =>
  request<ActiveDatesPayload>(`/app/em/${roomId}/active-dates`, { method: 'GET' });

// ────────────────────────────────────────────────
// 특정 날짜 첫 메시지 기준 앞/뒤 조회 — 캘린더 날짜 검색 점프용 (RN 패리티)
// ────────────────────────────────────────────────

export interface FirstOnListPayload {
  items: WebSocketPublishItem[];
}

/** DM 특정 날짜 첫 메시지 기준 이전 메시지 조회 */
export const apiGetDMFirstOnBefore = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/dm/${roomId}/messages/first-on/before?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

/** DM 특정 날짜 첫 메시지 기준 이후 메시지 조회 */
export const apiGetDMFirstOnAfter = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/dm/${roomId}/messages/first-on/after?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

/** GM 특정 날짜 첫 메시지 기준 이전 메시지 조회 */
export const apiGetGMFirstOnBefore = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/gm/${roomId}/messages/first-on/before?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

/** GM 특정 날짜 첫 메시지 기준 이후 메시지 조회 */
export const apiGetGMFirstOnAfter = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/gm/${roomId}/messages/first-on/after?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

/** EM 특정 날짜 첫 메시지 기준 이전 메시지 조회 */
export const apiGetEMFirstOnBefore = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/em/${roomId}/messages/first-on/before?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

/** EM 특정 날짜 첫 메시지 기준 이후 메시지 조회 */
export const apiGetEMFirstOnAfter = (roomId: string, date: string, beforeCount = 50) =>
  request<FirstOnListPayload>(
    `/app/em/${roomId}/messages/first-on/after?date=${date}&beforeCount=${beforeCount}`,
    { method: 'GET' },
  );

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

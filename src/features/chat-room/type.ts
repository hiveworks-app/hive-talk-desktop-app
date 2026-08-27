import { WebSocketChannelTypes } from '@/shared/types/websocket';

export interface ChatFileUploadRequestProps {
  fileName: string;
  /** presigned URL 요청 쿼리스트링 필수값 — 누락 시 서버 400 "유효하지 않은 데이터" (RN 패리티) */
  contentLength: number;
}

export interface ChatFileUploadResponsePayload {
  putPresignedUrl: string;
  fileKey: string;
  size: number;
}

export interface UploadChatFileProps {
  channelType: WebSocketChannelTypes;
  file: File;
}

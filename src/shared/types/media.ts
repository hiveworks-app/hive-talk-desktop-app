import { WebSocketMessageType } from '@/shared/types/websocket';

export interface MediaListType {
  id: string;
  messageId: string;
  createdAt: string;
  thumbnailPath: string;
  thumbnailPresignedUrl?: string;
  messageContentType: WebSocketMessageType;
  presignedUrl?: string;
  path: string;
  author: string;
  /** 발신자 userId — 뷰어 차단 표기용 */
  senderId?: string;
  fileSize?: number;
  duration?: number;
}

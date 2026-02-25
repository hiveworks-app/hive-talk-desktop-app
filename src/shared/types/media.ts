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
  fileSize?: number;
}

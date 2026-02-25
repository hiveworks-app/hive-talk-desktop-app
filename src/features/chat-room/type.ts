import { WebSocketChannelTypes } from '@/shared/types/websocket';

export interface ChatFileUploadRequestProps {
  fileName: string;
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

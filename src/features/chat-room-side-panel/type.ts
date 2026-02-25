import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { Pagination } from '@/shared/types/pagination';
import { WebSocketChannelTypes, WebSocketPublishItem } from '@/shared/types/websocket';

export interface GetSidePanelAttachmentsProps {
  roomId: string;
  lastMessageId: string;
  messageContentType: string[];
  channelType?: WebSocketChannelTypes;
}

export interface GetSidePanelAttachmentsResponse {
  items: WebSocketPublishItem[];
}

export interface GetSidePanelParticipantsResponse {
  items: ParticipantItemsType[];
  pagination: Pagination;
}

import { RoomModelType } from '@/shared/types/chatRoom';
import { WebSocketPublishItem } from '@/shared/types/websocket';

export interface GetChatRoomListPayload {
  items: GetChatRoomListItemType[];
}

export interface GetChatRoomListItemType {
  messageList: WebSocketPublishItem[];
  roomModel: RoomModelType;
  notReadCount: number;
}

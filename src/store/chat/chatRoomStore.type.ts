import type { WebSocketChannelTypes, WebSocketPublishItem } from '@/shared/types/websocket';

export interface ChatRoomInfo {
  roomId: string;
  roomName: string;
  channelType: WebSocketChannelTypes;
  totalUserCount: number;
  otherUserIsExit: boolean;
  invitedUserIds: string[];
  lastMessage: WebSocketPublishItem | null;
}

export interface ChatRoomInfoState extends ChatRoomInfo {
  setChatRoomInfo: (info: Partial<ChatRoomInfo>) => void;
  resetChatRoomInfo: () => void;
}

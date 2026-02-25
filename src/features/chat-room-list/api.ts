import { GetChatRoomListPayload } from '@/features/chat-room-list/type';
import { request } from '@/shared/api';
import { WebSocketChannelUrlTypes } from '@/shared/types/websocket';

export const apiGetChatRoomList = (type: WebSocketChannelUrlTypes) => {
  return request<GetChatRoomListPayload>(`/app/${type}/rooms`, { method: 'GET' });
};

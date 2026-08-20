import { GetChatRoomListItemType, GetChatRoomListPayload } from '@/features/chat-room-list/type';
import { request } from '@/shared/api';
import { WebSocketChannelUrlTypes } from '@/shared/types/websocket';

export const apiGetChatRoomList = (type: WebSocketChannelUrlTypes) => {
  return request<GetChatRoomListPayload>(`/app/${type}/rooms`, { method: 'GET' });
};

/**
 * DM 전용 — 상대방과의 기존 채팅방 존재 확인 (내가 나갔던 방 복귀 포함).
 * 방 생성 전 dedup 3단계(캐시 → 서버 dm-check → 신규 draft)의 서버 단계 (RN apiGetDmCheck 패리티).
 */
export const apiGetDmCheck = (userId: string) => {
  return request<GetChatRoomListItemType | null>(`/app/dm/${userId}`, { method: 'GET' });
};

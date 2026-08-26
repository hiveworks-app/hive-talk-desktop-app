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

export interface BatchExitRoomsRequest {
  dmRoomIds: string[];
  gmRoomIds: string[];
  emRoomIds: string[];
}

/**
 * DM/GM/EM 채팅방 일괄 나가기 (RN apiBatchExitRooms 패리티).
 * 서버는 각 방별로 개별 처리하며, 일부 실패해도 나머지는 계속 진행한다.
 * 방 관리의 다건 나가기는 WS EXIT 연발 대신 이 전용 REST를 사용한다 — 실패 시 호출부가
 * invalidate 롤백으로 목록을 서버 상태에 재수렴시킨다.
 */
export const apiBatchExitRooms = (data: BatchExitRoomsRequest) =>
  request<unknown>('/app/rooms/exit', {
    method: 'DELETE',
    body: data,
  });

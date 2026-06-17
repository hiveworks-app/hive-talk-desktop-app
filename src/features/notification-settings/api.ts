import { request } from '@/shared/api';
import type { PushSettingsResponse } from './type';

/** 알림 마스터 토글(채팅/초대) 상태 조회 */
export const apiGetPushSettings = () =>
  request<PushSettingsResponse>('/app/push/settings', { method: 'GET' });

/** 전체 채팅방 푸시 알림 ON */
export const apiPushOnAllRooms = () => request<null>('/app/all-rooms/push/on', { method: 'PUT' });

/** 전체 채팅방 푸시 알림 OFF */
export const apiPushOffAllRooms = () => request<null>('/app/all-rooms/push/off', { method: 'PUT' });

/** 전체 초대 알림 ON */
export const apiPushOnAllInvites = () => request<null>('/app/all-invites/push/on', { method: 'PUT' });

/** 전체 초대 알림 OFF */
export const apiPushOffAllInvites = () => request<null>('/app/all-invites/push/off', { method: 'PUT' });

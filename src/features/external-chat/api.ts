import { request } from '@/shared/api';
import type {
  CheckDuplicateEMRequestProps,
  CheckDuplicateEMResponseProps,
  EMCreateRequestProps,
  EMCreateResponseProps,
} from './type';

export const apiEMCreate = (data: EMCreateRequestProps) =>
  request<EMCreateResponseProps>('/app/em', {
    method: 'POST',
    body: data,
  });

/** 선택 멤버 조합으로 이미 존재하는 협력방이 있는지 검사 */
export const apiCheckDuplicateEM = (data: CheckDuplicateEMRequestProps) =>
  request<CheckDuplicateEMResponseProps>('/app/em/rooms/check-duplicate', {
    method: 'POST',
    body: data,
  });

export const apiInviteToEMRoom = (roomId: string, userIds: string[]) =>
  request<void>(`/app/em/rooms/${roomId}/invite`, {
    method: 'POST',
    body: { userIds },
  });

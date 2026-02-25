import { request } from '@/shared/api';
import type { EMCreateRequestProps, EMCreateResponseProps } from './type';

export const apiEMCreate = (data: EMCreateRequestProps) =>
  request<EMCreateResponseProps>('/app/em', {
    method: 'POST',
    body: data,
  });

export const apiInviteToEMRoom = (roomId: string, userIds: string[]) =>
  request<void>(`/app/em/rooms/${roomId}/invite`, {
    method: 'POST',
    body: { userIds },
  });

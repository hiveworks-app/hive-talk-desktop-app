import {
  DMCreateResponseProps,
  GMCreateRequestProps,
  GMCreateResponseProps,
} from '@/features/create-chat-room/type';
import { request } from '@/shared/api';

/**
 * 1:1 대화방 생성
 */
export const apiDMCreate = (userId: string) =>
  request<DMCreateResponseProps>(`/app/dm/${userId}`, {
    method: 'POST',
  });

/**
 * 그룹 대화방 생성
 */
export const apiGMCreate = (data: GMCreateRequestProps) =>
  request<GMCreateResponseProps>('/app/gm', { method: 'POST', body: data });

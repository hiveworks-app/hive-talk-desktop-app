import { request } from '@/shared/api';
import type {
  ExternalMembersGetPayload,
  InviteExternalUserRequest,
  InviteExternalUserResponse,
} from './type';

export const apiGetExternalMembers = (search?: string) => {
  const query = search ? `&search=${encodeURIComponent(search)}` : '';
  return request<ExternalMembersGetPayload>(
    `/app/members/external?page=1&size=1000${query}`,
    { method: 'GET' },
  );
};

export const apiInviteExternalUser = (data: InviteExternalUserRequest) =>
  request<InviteExternalUserResponse>('/app/members/external/invite', {
    method: 'POST',
    body: data,
  });

export const apiCancelExternalInvite = (userId: number) =>
  request<void>(`/app/members/external/${userId}/invite`, {
    method: 'DELETE',
  });

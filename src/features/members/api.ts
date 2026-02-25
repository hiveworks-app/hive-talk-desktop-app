import { MembersGetPayload } from '@/features/members/type';
import { request } from '@/shared/api';

export const apiGetMembersList = () => {
  return request<MembersGetPayload>('/app/users?page=1&size=1000&sort=name%2CASC', {
    method: 'GET',
  });
};

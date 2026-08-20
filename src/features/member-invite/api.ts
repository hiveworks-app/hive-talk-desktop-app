import { request } from '@/shared/api';

/** 소속(사내) 초대 수락 (RN 패리티) */
export const apiAcceptMemberInvite = (inviteId: string) =>
  request<null>(`/app/companies/invites/${inviteId}`, {
    method: 'PUT',
    body: { result: 'ACCEPT' },
  });

/** 소속(사내) 초대 거절 */
export const apiRejectMemberInvite = (inviteId: string) =>
  request<null>(`/app/companies/invites/${inviteId}`, {
    method: 'PUT',
    body: { result: 'REJECTED' },
  });

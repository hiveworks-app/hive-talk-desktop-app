import { MembersGetPayload } from '@/features/members/type';
import { request } from '@/shared/api';

/** GET /app/users/pinned — 고정(관심) 멤버 목록 조회 */
export const apiGetPinnedMembers = () =>
  request<MembersGetPayload>('/app/users/pinned', { method: 'GET' });

/**
 * PUT /app/users/pinned — 고정 멤버 전체 교체 (배열 순서 = 고정 순서).
 * 단건 추가 엔드포인트가 없어, 단건 등록은 [현재 고정 목록 + 신규 id]로 호출한다.
 */
export const apiReplacePinnedMembers = (pinnedUserIds: number[]) =>
  request<string>('/app/users/pinned', {
    method: 'PUT',
    body: { pinnedUserIds },
  });

/** DELETE /app/users/pinned — 고정 멤버 해제 (PUT과 동일한 body 형식) */
export const apiDeletePinnedMember = (pinnedUserIds: number[]) =>
  request<string>('/app/users/pinned', {
    method: 'DELETE',
    body: { pinnedUserIds },
  });

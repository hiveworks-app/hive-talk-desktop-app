import { MembersGetPayload } from '@/features/members/type';
import { request } from '@/shared/api';

/** GET /app/users/pinned — 고정 멤버 목록 조회 */
export const apiGetPinnedMembers = () =>
  request<MembersGetPayload>('/app/users/pinned', { method: 'GET' });

/**
 * DELETE /app/users/pinned — 고정 멤버 해제.
 * 데스크톱 관심멤버 편집은 모바일 전담(view-only)이나, 협력멤버 삭제 시
 * 사전 unpin 용도로 external-member 기능에서 사용한다.
 */
export const apiDeletePinnedMember = (pinnedUserIds: number[]) =>
  request<string>('/app/users/pinned', {
    method: 'DELETE',
    body: { pinnedUserIds },
  });

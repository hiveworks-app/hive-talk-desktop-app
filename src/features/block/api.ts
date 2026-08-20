import { request } from '@/shared/api';
import type { MembersGetPayload } from '@/features/members/type';

/**
 * 사용자 차단 API (RN features/block/api.ts 패리티)
 * - 멱등: 이미 차단 중 재요청 201 / 미차단 해제 200. 차단은 단방향(피차단자는 모름).
 * - 서버 검증 에러: U018(본인 차단) · U020(내 회사 ADMIN 차단) → 4xx.
 * - ⚠️ 목록 응답의 userId는 number로 올 수 있음 — string 정규화는 호출부(queries.ts)에서 수행.
 */

/** GET /app/users/blocks — 차단한 멤버 목록 (서버 정렬: 차단 최신순) */
export const apiGetBlockedMembers = () =>
  request<MembersGetPayload>('/app/users/blocks', { method: 'GET' });

/** POST /app/users/blocks — 사용자 차단 */
export const apiBlockMember = (targetUserId: number) =>
  request<string>('/app/users/blocks', { method: 'POST', body: { targetUserId } });

/** DELETE /app/users/blocks/{userId} — 차단 해제 */
export const apiUnblockMember = (userId: number) =>
  request<string>(`/app/users/blocks/${userId}`, { method: 'DELETE' });

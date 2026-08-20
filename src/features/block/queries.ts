import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlockMember, apiGetBlockedMembers, apiUnblockMember } from '@/features/block/api';
import { BLOCK_MESSAGES } from '@/features/block/blockedMessage';
import { BLOCKED_MEMBERS_KEY, MEMBERS_KEY, PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useUIStore } from '@/store/uiStore';

/**
 * 차단 멤버 쿼리/뮤테이션 (RN features/block/queries.ts 패리티).
 *
 * ⚠️ 설계 원칙 (RN에서 검증된 결정 — 반드시 유지):
 * 1. 차단/해제 후 BLOCKED_MEMBERS_KEY를 절대 invalidate하지 않는다.
 *    서버가 eventual-consistent라 stale GET이 optimistic 반영분을 덮어
 *    "차단한 사람이 되살아나는" 깜빡임이 발생한다. setQueryData 증분만 허용.
 * 2. 해제는 pessimistic(onSuccess에서만 캐시 제거) — 실패 시 되살리기 UX가 더 나쁨.
 * 3. 조회 결과는 blockedMembersStore로 write-through — cold start 직후에도
 *    소켓 핸들러(isBlockedUser)가 직전 세션 차단 목록으로 즉시 정확하게 판정.
 */

/** 차단 멤버 목록 조회 (차단 최신순) + 스토어 write-through */
export const useGetBlockedMembers = () => {
  const accessToken = useAuthStore(s => s.accessToken);
  const query = useQuery({
    queryKey: BLOCKED_MEMBERS_KEY,
    queryFn: async () => {
      const res = await apiGetBlockedMembers();
      // 서버 응답 userId가 number로 올 수 있어 string 정규화 (앱 전역 계약)
      return res.payload.items.map(m => ({ ...m, userId: String(m.userId) }));
    },
    staleTime: 30 * 1000,
    enabled: !!accessToken,
  });

  const replaceAll = useBlockedMembersStore(s => s.replaceAll);
  useEffect(() => {
    if (query.data) replaceAll(query.data);
  }, [query.data, replaceAll]);

  return query;
};

/** 사용자 차단 — optimistic (캐시·스토어 맨 앞 삽입 = 차단 최신순) */
export const useBlockMember = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (member: MemberItem) => apiBlockMember(Number(member.userId)),
    onMutate: async (member: MemberItem) => {
      await queryClient.cancelQueries({ queryKey: BLOCKED_MEMBERS_KEY });
      const prev = queryClient.getQueryData<MemberItem[]>(BLOCKED_MEMBERS_KEY);
      const normalized = { ...member, userId: String(member.userId) };
      queryClient.setQueryData<MemberItem[]>(BLOCKED_MEMBERS_KEY, old => [
        normalized,
        ...(old ?? []).filter(m => String(m.userId) !== normalized.userId),
      ]);
      useBlockedMembersStore.getState().addMany([normalized]);
      return { prev };
    },
    onError: (_err, member, context) => {
      if (context?.prev) queryClient.setQueryData(BLOCKED_MEMBERS_KEY, context.prev);
      useBlockedMembersStore.getState().removeMany([String(member.userId)]);
      showSnackbar({ message: BLOCK_MESSAGES.blockFailed, state: 'error' });
    },
    onSuccess: () => {
      // 서버가 차단 시 관심멤버 자동 unpin — 관심멤버 목록만 재조회 (차단 목록 invalidate 금지)
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
    },
  });
};

/** 차단 해제 — pessimistic (onSuccess에서만 캐시·스토어 제거) */
export const useUnblockMember = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (userId: string) => apiUnblockMember(Number(userId)),
    onMutate: async () => {
      // cold start 직후 늦게 도착한 첫 GET 응답이 방금 해제한 사용자를 되살리는 race 방지
      await queryClient.cancelQueries({ queryKey: BLOCKED_MEMBERS_KEY });
    },
    onSuccess: (_res, userId) => {
      queryClient.setQueryData<MemberItem[]>(BLOCKED_MEMBERS_KEY, old =>
        (old ?? []).filter(m => String(m.userId) !== String(userId)),
      );
      useBlockedMembersStore.getState().removeMany([String(userId)]);
      // 멤버 목록 복원 (차단 목록과 독립이라 invalidate 안전)
      queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
    },
    onError: () => {
      showSnackbar({ message: BLOCK_MESSAGES.unblockFailed, state: 'error' });
    },
  });
};

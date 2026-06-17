import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiDeletePinnedMember,
  apiGetPinnedMembers,
  apiReplacePinnedMembers,
} from '@/features/pinned-members/api';
import { PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';

/** 고정 멤버 목록 조회 */
export const useGetPinnedMembers = () => {
  const accessToken = useAuthStore(s => s.accessToken);
  return useQuery({
    queryKey: PINNED_MEMBERS_KEY,
    queryFn: async () => {
      const res = await apiGetPinnedMembers();
      return res.payload.items;
    },
    staleTime: 30 * 1000,
    enabled: !!accessToken,
  });
};

/** 고정 멤버 전체 교체 (PUT) */
export const useReplacePinnedMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinnedUserIds: number[]) => apiReplacePinnedMembers(pinnedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
    },
  });
};

/** 고정 멤버 해제 (DELETE) */
export const useDeletePinnedMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinnedUserIds: number[]) => apiDeletePinnedMember(pinnedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
    },
  });
};

/** 고정 멤버 userId Set을 빠르게 조회하는 유틸 */
export function usePinnedMemberIds(): Set<string> {
  const { data: pinnedMembers } = useGetPinnedMembers();
  if (!pinnedMembers) return new Set();
  return new Set(pinnedMembers.map(m => String(m.userId)));
}

/**
 * 데스크톱 전용 — 멤버 행의 별(star) 토글로 즉시 고정/해제.
 * - 고정: 기존 고정목록 끝에 추가하여 PUT(전체 교체)
 * - 해제: 해당 userId만 DELETE
 * 모바일은 별도 편집 화면(드래그 리오더)로 관리하지만, 데스크톱은 인라인 토글이 자연스럽다.
 */
export function useTogglePinnedMember() {
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const replaceMutation = useReplacePinnedMembers();
  const deleteMutation = useDeletePinnedMember();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const toggle = useCallback(
    async (member: MemberItem) => {
      const targetId = Number(member.userId);
      const isPinned = pinnedMembers.some(m => String(m.userId) === String(member.userId));

      try {
        if (isPinned) {
          await deleteMutation.mutateAsync([targetId]);
          showSnackbar({ message: '관심 멤버에서 해제했습니다.', state: 'info' });
        } else {
          const mergedIds = [...pinnedMembers.map(m => Number(m.userId)), targetId];
          await replaceMutation.mutateAsync(mergedIds);
          showSnackbar({ message: '관심 멤버로 등록했습니다.', state: 'success' });
        }
      } catch {
        showSnackbar({ message: '관심 멤버 변경에 실패했습니다.', state: 'error' });
      }
    },
    [pinnedMembers, deleteMutation, replaceMutation, showSnackbar],
  );

  return { toggle, isPending: replaceMutation.isPending || deleteMutation.isPending };
}

/**
 * 데스크톱 전용 — 관심멤버 드래그 순서변경.
 * orderedUserIds(새 순서)로 캐시를 즉시 재정렬(낙관적)한 뒤 PUT(전체 교체).
 * 실패 시 이전 순서로 rollback. PUT 성공 시 useReplacePinnedMembers가 invalidate → 정합.
 */
export function useReorderPinnedMembers() {
  const queryClient = useQueryClient();
  const replaceMutation = useReplacePinnedMembers();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const reorder = useCallback(
    async (orderedUserIds: string[]) => {
      const previous = queryClient.getQueryData<MemberItem[]>(PINNED_MEMBERS_KEY);
      if (previous) {
        const map = new Map(previous.map(m => [String(m.userId), m]));
        const reordered = orderedUserIds
          .map(id => map.get(id))
          .filter((m): m is MemberItem => m !== undefined);
        queryClient.setQueryData(PINNED_MEMBERS_KEY, reordered);
      }

      try {
        await replaceMutation.mutateAsync(orderedUserIds.map(Number));
      } catch {
        if (previous) queryClient.setQueryData(PINNED_MEMBERS_KEY, previous);
        showSnackbar({ message: '관심 멤버 순서 변경에 실패했습니다.', state: 'error' });
      }
    },
    [queryClient, replaceMutation, showSnackbar],
  );

  return { reorder, isPending: replaceMutation.isPending };
}

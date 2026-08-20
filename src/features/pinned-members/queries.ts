import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiDeletePinnedMember,
  apiGetPinnedMembers,
  apiReplacePinnedMembers,
} from '@/features/pinned-members/api';
import { PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';

/**
 * 고정(관심) 멤버 목록 조회.
 * 등록/해제는 멤버 상세 모달의 별 토글, 순서변경·일괄 편집은 멤버목록 편집
 * (MemberListEditDialog — 기어 메뉴 진입)에서 지원한다 (RN 패리티).
 */
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

/** 고정 멤버 전체 교체(PUT) — 단건 등록은 [현재 목록 + 신규 id]로 호출한다. */
export const useReplacePinnedMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinnedUserIds: number[]) => apiReplacePinnedMembers(pinnedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
    },
  });
};

/** 고정 멤버 해제(DELETE) */
export const useDeletePinnedMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinnedUserIds: number[]) => apiDeletePinnedMember(pinnedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
    },
  });
};

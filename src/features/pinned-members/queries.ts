import { useQuery } from '@tanstack/react-query';
import { apiGetPinnedMembers } from '@/features/pinned-members/api';
import { PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';

/**
 * 고정(관심) 멤버 목록 조회 — 데스크톱은 표시 전용.
 * 관심멤버 등록/해제·순서변경은 모바일 앱이 전담하고, 데스크톱은 결과만 보여준다.
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

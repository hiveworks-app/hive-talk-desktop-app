'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGetMembersList } from '@/features/members/api';
import { CHECK_HOURS_MS } from '@/shared/config/constants';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';

export const useGetMembers = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: async () => {
      const res = await apiGetMembersList();
      return res.payload.items;
    },
    enabled: !!user?.id,
    staleTime: CHECK_HOURS_MS,
    refetchOnWindowFocus: false,
  });
};

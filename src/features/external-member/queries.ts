'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXTERNAL_MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetExternalMembers,
  apiInviteExternalUser,
  apiCancelExternalInvite,
} from './api';
import type { InviteExternalUserRequest } from './type';

export const useGetExternalMembers = (search?: string) => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: EXTERNAL_MEMBERS_KEY(search),
    queryFn: async () => {
      const res = await apiGetExternalMembers(search);
      return res.payload.items;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};

export const useInviteExternalUser = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (data: InviteExternalUserRequest) => apiInviteExternalUser(data),
    onSuccess: () => {
      showSnackbar({ message: '초대를 보냈습니다.', state: 'success' });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
    onError: () => {
      showSnackbar({ message: '초대에 실패했습니다.', state: 'error' });
    },
  });
};

export const useCancelExternalInvite = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (userId: number) => apiCancelExternalInvite(userId),
    onSuccess: () => {
      showSnackbar({ message: '초대를 취소했습니다.', state: 'success' });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
    onError: () => {
      showSnackbar({ message: '초대 취소에 실패했습니다.', state: 'error' });
    },
  });
};

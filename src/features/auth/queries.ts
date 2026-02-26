'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { del } from 'idb-keyval';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import { apiLogin, apiLogout } from './api';

export const useLogin = () => {
  return useMutation({ mutationFn: apiLogin });
};

export const useLogout = () => {
  const logout = useAuthStore(s => s.logout);
  const queryClient = useQueryClient();
  const router = useRouter();
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiLogout,
    onSuccess: async () => {
      queryClient.clear();
      await del('hiveworks-query-cache');
      logout();
      router.replace('/login');
    },
    onError: () => {
      showSnackbar({
        message: '로그아웃에 실패했습니다. 다시 시도해주세요.',
        state: 'error',
      });
    },
  });
};

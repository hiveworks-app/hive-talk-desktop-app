'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { isApiError } from '@/shared/api';
import type { UserType } from '@/shared/types/user';
import { USER_TYPE } from '@/shared/types/user';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import { apiLogin, apiLogout } from './api';
import type { LoginErrorResponse } from './type';

export const useLogin = () => {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiLogin,
    onSuccess: (res, params) => {
      const { deviceId, deviceType } = params;
      const deviceInfo = { deviceId, deviceType };
      const { accessToken, refreshToken, ...rest } = res.payload;
      const user = { ...rest, userType: USER_TYPE.ORG_MEMBER as UserType };
      setAuth({ accessToken, refreshToken, deviceInfo, user });

      // middleware 보조 쿠키 설정 (서버사이드 인증 가드용)
      document.cookie = `has-auth=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      router.replace('/members');
    },
    onError: err => {
      if (isApiError<LoginErrorResponse>(err)) {
        const message = err.message || '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        showSnackbar({ message, state: 'error' });
        return;
      }

      if (err instanceof Error) {
        showSnackbar({ message: err.message, state: 'error' });
        return;
      }

      showSnackbar({ message: '로그인 실패', state: 'error' });
    },
  });
};

export const useLogout = () => {
  const logout = useAuthStore(s => s.logout);
  const router = useRouter();
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
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

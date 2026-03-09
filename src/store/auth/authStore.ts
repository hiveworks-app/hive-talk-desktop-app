'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LoginResponseProps } from '@/features/auth/type';
import type { OrganizationInfo, UserType } from '@/shared/types/user';

export interface AuthSaveUserInfoTypes
  extends Omit<LoginResponseProps, 'accessToken' | 'refreshToken'> {
  profileImageUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  userType: UserType;
  organization?: OrganizationInfo;
}

export type DeviceInfoTypes = {
  deviceId: string;
  deviceType: 'DESKTOP';
};

interface SetAuthProps {
  accessToken?: string;
  refreshToken?: string;
  deviceInfo?: DeviceInfoTypes;
  user?: AuthSaveUserInfoTypes;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  deviceInfo: DeviceInfoTypes | null;
  user: AuthSaveUserInfoTypes | null;
  setAuth: (props: SetAuthProps) => void;
  logout: () => void;
}

const initAuthState = {
  accessToken: null,
  refreshToken: null,
  deviceInfo: null,
  user: null,
};

const AUTH_COOKIE = 'has-auth=1; path=/; max-age=604800; SameSite=Lax';

function syncAuthCookie(hasToken: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = hasToken ? AUTH_COOKIE : 'has-auth=; max-age=0; path=/';
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      ...initAuthState,
      setAuth: ({ accessToken, refreshToken, deviceInfo, user }) =>
        set(state => {
          const newToken = accessToken ?? state.accessToken;
          if (newToken) syncAuthCookie(true);
          return {
            ...state,
            accessToken: newToken,
            refreshToken: refreshToken ?? state.refreshToken,
            deviceInfo: deviceInfo ?? state.deviceInfo,
            user: user ?? state.user,
          };
        }),
      logout: () => {
        set({ ...initAuthState });
        syncAuthCookie(false);
      },
    }),
    {
      name: 'user-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => state => {
        if (typeof window === 'undefined') return;

        const autoLogin = localStorage.getItem('auto-login') === 'true';
        if (state?.accessToken && !autoLogin) {
          // 자동로그인 OFF → 인증 상태 초기화
          useAuthStore.getState().logout();
          return;
        }
        // localStorage → Zustand 복원 완료 후 쿠키 동기화
        syncAuthCookie(!!state?.accessToken);
      },
    },
  ),
);

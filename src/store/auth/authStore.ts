'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthState } from './type';

export type { AuthSaveUserInfoTypes, DeviceInfoTypes, SetAuthProps, AuthState } from './type';

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
        syncAuthCookie(!!state?.accessToken);
      },
    },
  ),
);

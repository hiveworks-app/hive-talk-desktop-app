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

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      ...initAuthState,
      setAuth: ({ accessToken, refreshToken, deviceInfo, user }) =>
        set(state => ({
          ...state,
          accessToken: accessToken ?? state.accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
          deviceInfo: deviceInfo ?? state.deviceInfo,
          user: user ?? state.user,
        })),
      logout: () => {
        set({ ...initAuthState });
        // middleware 보조 쿠키 삭제
        if (typeof document !== 'undefined') {
          document.cookie = 'has-auth=; max-age=0; path=/';
        }
      },
    }),
    {
      name: 'user-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

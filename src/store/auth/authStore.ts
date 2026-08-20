'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
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
        // 계정 데이터 잔존 방지 — 차단 목록·드래프트·실패 메시지는 계정 종속 (RN safeClear 패리티)
        useBlockedMembersStore.getState().clear();
        useDraftStore.setState({ drafts: {} });
        useFailedMessagesStore.getState().clearAll();
        useMemberInviteStore.getState().reset();
        pendingReadRegistry.reset();
      },
    }),
    {
      name: 'user-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;

        // 앱 cold start 시에만 auto-login 체크
        // sessionStorage는 앱(윈도우) 종료 시 자동 초기화됨
        if (!sessionStorage.getItem('auth-checked')) {
          sessionStorage.setItem('auth-checked', '1');
          if (localStorage.getItem('auto-login') !== 'true' && state.accessToken) {
            state.logout();
            return;
          }
        }

        syncAuthCookie(!!state.accessToken);
      },
    },
  ),
);

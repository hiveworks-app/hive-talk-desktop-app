'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
import { isPopupWindow } from '@/shared/utils/popupWindow';
import { runLogoutCleanups } from '@/shared/utils/logoutCleanup';
import { wsRelay } from '@/shared/websocket/wsRelay';
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
        // 멀티 채팅창은 이 창(허브)의 소켓에 얹혀 있다 — 로그아웃하면 남겨둘 이유가 없고,
        // 남기면 아무것도 못 받는 죽은 창이 된다 (Electron 아니면 no-op)
        wsRelay.shutdown();
        // 계정 데이터 잔존 방지 — 차단 목록·드래프트·실패 메시지는 계정 종속 (RN safeClear 패리티)
        useBlockedMembersStore.getState().clear();
        useDraftStore.setState({ drafts: {} });
        useFailedMessagesStore.getState().clearAll();
        useMemberInviteStore.getState().reset();
        pendingReadRegistry.reset();
        // Dock/트레이 뱃지 초기화 — 로그아웃 후 마지막 미읽음 수가 남지 않게 (RN safeClear 패리티)
        (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } })
          .electronAPI?.setBadgeCount?.(0);
        // RQ 캐시·영속 캐시 등 Provider 등록 정리 일괄 실행 — 호출 경로(설정/탈퇴/계정정지/트레이)마다
        // 정리 범위가 다르던 문제 통일 (RN logout() 내부 일괄 정리 패리티)
        runLogoutCleanups();
      },
    }),
    {
      name: 'user-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;

        // 앱 cold start 시에만 auto-login 체크
        // sessionStorage는 앱(윈도우) 종료 시 자동 초기화됨
        //
        // ⚠️ sessionStorage는 origin이 아니라 **창(탭)마다 독립**이다. localStorage/쿠키와 다르다.
        //    멀티 채팅창(팝업)은 새 BrowserWindow라 이 플래그가 항상 비어 있어 "앱을 새로 켰다"로
        //    오판되고, 자동 로그인이 꺼져 있으면(기본값) logout()이 돈다. 그 여파가 팝업에 그치지
        //    않는다 — logout()의 set()은 persist를 타고 localStorage의 user-auth를 비우고,
        //    syncAuthCookie(false)는 origin 공유 자원인 has-auth 쿠키를 지워 **메인 창의 로그인까지
        //    풀어버린다**.
        //    팝업은 "앱을 새로 켠 것"이 아니라 이미 로그인된 앱에서 파생된 창이므로 판정에서 제외한다.
        //    (보조 창이 더 늘어나면 경로 검사 대신 preload가 주는 "첫 창" 플래그로 옮길 것)
        if (!isPopupWindow() && !sessionStorage.getItem('auth-checked')) {
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

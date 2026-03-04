'use client';

import { useEffect, useState } from 'react';
import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';
import { useAuthStore } from '@/store/auth/authStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);

  // Windows Electron: titleBarOverlay 패딩용 data attribute 설정
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { platform?: string } }).electronAPI;
    if (api?.platform === 'win32') {
      document.documentElement.setAttribute('data-electron-win', '');
    }
  }, []);

  // Zustand persist 복원 완료 후 인증 확인
  useEffect(() => {
    const check = () => {
      if (!useAuthStore.getState().accessToken) {
        window.location.href = '/login';
        return;
      }
      setAuthChecked(true);
    };

    if (useAuthStore.persist.hasHydrated()) {
      check();
    } else {
      useAuthStore.persist.onFinishHydration(check);
    }
  }, []);

  // 로그아웃 시 로그인 페이지로 이동
  useEffect(() => {
    if (authChecked && !accessToken) {
      window.location.href = '/login';
    }
  }, [authChecked, accessToken]);

  if (!authChecked) return null;

  return (
    <WebSocketProvider>
      <div className="relative flex h-dvh overflow-hidden">
        <AppNav />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WebSocketProvider>
  );
}

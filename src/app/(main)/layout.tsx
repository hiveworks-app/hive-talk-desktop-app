'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';
import { useAuthStore } from '@/store/auth/authStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);

  // Zustand persist 복원 완료 후 인증 확인
  useEffect(() => {
    const check = () => {
      if (!useAuthStore.getState().accessToken) {
        router.replace('/login');
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
      router.replace('/login');
    }
  }, [authChecked, accessToken]);

  if (!authChecked) return null;

  return (
    <WebSocketProvider>
      <div className="relative flex h-full overflow-hidden">
        <AppNav />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WebSocketProvider>
  );
}

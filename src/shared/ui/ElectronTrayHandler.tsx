'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

interface ElectronAPI {
  isElectron?: boolean;
  onTrayLockMode?: (callback: () => void) => () => void;
  onTrayLogout?: (callback: () => void) => () => void;
  setTrayAuthState?: (isLoggedIn: boolean) => void;
  setTrayLockState?: (isLocked: boolean) => void;
}

function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

export function ElectronTrayHandler() {
  const router = useRouter();
  const accessToken = useAuthStore(s => s.accessToken);
  const isLocked = useUIStore(s => s.isLocked);

  // 로그인 상태 변경 시 트레이 메뉴 활성화/비활성화 동기화
  useEffect(() => {
    getElectronAPI()?.setTrayAuthState?.(!!accessToken);
  }, [accessToken]);

  // 잠금 상태 변경 시 트레이 메뉴 동기화
  useEffect(() => {
    getElectronAPI()?.setTrayLockState?.(isLocked);
  }, [isLocked]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.isElectron) return;

    const cleanupLock = api.onTrayLockMode?.(() => {
      if (!useAuthStore.getState().accessToken) return;
      useUIStore.getState().lock();
    });

    const cleanupLogout = api.onTrayLogout?.(() => {
      useAuthStore.getState().logout();
      router.replace('/login');
    });

    return () => {
      cleanupLock?.();
      cleanupLogout?.();
    };
  }, []);

  return null;
}

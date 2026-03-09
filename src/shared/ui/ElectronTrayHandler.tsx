'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

interface ElectronAPI {
  isElectron?: boolean;
  onTrayLockMode?: (callback: () => void) => () => void;
  onTrayLogout?: (callback: () => void) => () => void;
}

export function ElectronTrayHandler() {
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    if (!api?.isElectron) return;

    const cleanupLock = api.onTrayLockMode?.(() => {
      useUIStore.getState().lock();
    });

    const cleanupLogout = api.onTrayLogout?.(() => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    });

    return () => {
      cleanupLock?.();
      cleanupLogout?.();
    };
  }, []);

  return null;
}

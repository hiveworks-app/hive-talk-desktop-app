'use client';

import { useEffect } from 'react';

export function ElectronPlatformDetector() {
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { platform?: string } }).electronAPI;
    if (!api?.platform) return;

    if (api.platform === 'darwin') {
      document.documentElement.setAttribute('data-electron-mac', '');
    } else if (api.platform === 'win32') {
      document.documentElement.setAttribute('data-electron-win', '');
    }
  }, []);

  return null;
}

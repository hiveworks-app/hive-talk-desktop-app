'use client';

import { useEffect, useState } from 'react';

export function useAutoUpdate() {
  const [updateReady, setUpdateReady] = useState<{ version: string } | null>(null);

  useEffect(() => {
    const electronAPI = (window as unknown as {
      electronAPI?: {
        isElectron?: boolean;
        onUpdateDownloaded?: (callback: (info: { version: string }) => void) => () => void;
        installUpdate?: () => void;
      };
    }).electronAPI;

    if (!electronAPI?.isElectron || !electronAPI.onUpdateDownloaded) return;

    const cleanup = electronAPI.onUpdateDownloaded((info) => {
      setUpdateReady(info);
    });

    return cleanup;
  }, []);

  const installUpdate = () => {
    const electronAPI = (window as unknown as {
      electronAPI?: { installUpdate?: () => void };
    }).electronAPI;
    electronAPI?.installUpdate?.();
  };

  return { updateReady, installUpdate };
}

'use client';

import { useEffect, useState } from 'react';

export function useAutoUpdate() {
  const [updateReady, setUpdateReady] = useState<{ version: string } | null>(null);
  // 재시작 클릭 후 종료 전 "적용 중" 안내 표시 — 곧바로 사라지면 버그처럼 느껴진다 (2026-09-02 피드백)
  const [isInstalling, setIsInstalling] = useState(false);

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
    if (isInstalling) return;
    // 종료 후 조용한 설치(수 초)는 OS가 보여줄 UI가 없다 — 종료 전에 "곧 꺼졌다가
    // 자동으로 다시 시작된다"를 예고해 공백 구간이 버그로 읽히지 않게 한다
    setIsInstalling(true);
    window.setTimeout(() => {
      const electronAPI = (window as unknown as {
        electronAPI?: { installUpdate?: () => void };
      }).electronAPI;
      electronAPI?.installUpdate?.();
    }, 1800);
  };

  return { updateReady, installUpdate, isInstalling };
}

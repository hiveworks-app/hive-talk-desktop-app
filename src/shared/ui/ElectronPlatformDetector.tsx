'use client';

import { useEffect } from 'react';
import { isPopupWindow } from '@/shared/utils/popupWindow';

export function ElectronPlatformDetector() {
  useEffect(() => {
    // 팝업 창은 OS 기본 타이틀바를 쓰므로 frameless 보정(data-electron-*)을 적용하지 않는다.
    // 적용하면 Windows에서 body padding-top 32px가 타이틀바 없이도 들어가 상단에 유령 여백이 생긴다.
    if (isPopupWindow()) return;
    const api = (window as unknown as { electronAPI?: { platform?: string } }).electronAPI;
    if (!api?.platform) return;

    if (api.platform === 'darwin') {
      document.documentElement.setAttribute('data-electron-mac', '');
    } else if (api.platform === 'win32' || api.platform === 'linux') {
      // linux도 titleBarOverlay(WCO) 버튼이 우상단에 그려진다(Electron 24+) —
      // 보정 없이는 멤버 목록 검색/초대현황 아이콘과 겹침 (2026-08-31 QA). 동일 규칙 적용.
      document.documentElement.setAttribute('data-electron-win', '');
    }
  }, []);

  return null;
}

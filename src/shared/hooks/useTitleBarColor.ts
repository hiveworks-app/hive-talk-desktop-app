'use client';

import { useEffect } from 'react';

const DEFAULT_TITLEBAR_COLOR = '#FFFFFF';

interface TitleBarApi {
  isElectron?: boolean;
  setTitleBarColor?: (color: string) => void;
}

/**
 * Windows 타이틀바 버튼(WCO) 영역 배경을 현재 화면 상단 배경색과 동기화.
 *
 * WCO는 버튼 사각형만 지정색으로 그려서, 흰색 고정이면 gray-50 화면(설정 계열)이나
 * 어두운 화면(미디어 뷰어)에서 버튼 부분만 흰 네모로 도드라진다 (2026-08-31 QA).
 * 풀스크린 오버레이 화면이 마운트 시 자기 배경색을 선언하고, 언마운트 시 기본(흰색)으로
 * 복원한다. dim 상태는 main 프로세스에서 이 기본층 위에 우선 적용된다.
 * macOS(신호등)·비 Electron 환경에서는 no-op.
 */
export function useTitleBarColor(color: string) {
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: TitleBarApi }).electronAPI;
    if (!api?.isElectron || !api.setTitleBarColor) return;
    api.setTitleBarColor(color);
    return () => api.setTitleBarColor?.(DEFAULT_TITLEBAR_COLOR);
  }, [color]);
}

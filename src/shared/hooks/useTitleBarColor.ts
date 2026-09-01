'use client';

import { useEffect } from 'react';

const DEFAULT_TITLEBAR_COLOR = '#FFFFFF';

interface TitleBarApi {
  isElectron?: boolean;
  setTitleBarColor?: (color: string) => void;
}

function getApi(): TitleBarApi | undefined {
  return (window as unknown as { electronAPI?: TitleBarApi }).electronAPI;
}

/* 겹친 오버레이가 각자 색을 선언하므로 스택으로 관리 — 최상단 색을 적용하고, 위층이
 * 닫히면 아래층 색으로 복원한다. (기존: 언마운트 시 무조건 흰색 복원 → 프로필(gray-50)
 * 위에서 미디어 뷰어(#111111)를 닫으면 흰 네모 재발 — 2026-09-01 QA) */
const colorStack: { color: string }[] = [];

function applyTopColor() {
  const api = getApi();
  if (!api?.isElectron || !api.setTitleBarColor) return;
  const top = colorStack[colorStack.length - 1];
  api.setTitleBarColor(top ? top.color : DEFAULT_TITLEBAR_COLOR);
}

/**
 * Windows 타이틀바 버튼(WCO) 영역 배경을 현재 화면 상단 배경색과 동기화.
 *
 * WCO는 버튼 사각형만 지정색으로 그려서, 흰색 고정이면 gray-50 화면(설정 계열)이나
 * 어두운 화면(미디어 뷰어)에서 버튼 부분만 흰 네모로 도드라진다 (2026-08-31 QA).
 * 풀스크린 오버레이 화면이 마운트 시 자기 배경색을 선언하고, 언마운트 시 그 아래층
 * (없으면 흰색)으로 복원한다. dim 상태는 main 프로세스에서 이 기본층 위에 우선 적용된다.
 * macOS(신호등)·비 Electron 환경에서는 no-op.
 */
export function useTitleBarColor(color: string) {
  useEffect(() => {
    const entry = { color };
    colorStack.push(entry);
    applyTopColor();
    return () => {
      const idx = colorStack.indexOf(entry);
      if (idx >= 0) colorStack.splice(idx, 1);
      applyTopColor();
    };
  }, [color]);
}

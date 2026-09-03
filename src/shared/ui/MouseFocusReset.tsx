'use client';

import { useEffect } from 'react';

/**
 * 마우스 클릭으로 포커스된 버튼을 클릭 직후 해제하는 전역 핸들러 (마우스 중심 데스크톱 앱 관례).
 *
 * 오버레이를 여는 버튼이 포커스를 유지한 채 ESC 등 키 입력이 발생하면 Chromium이
 * 그 포커스를 :focus-visible로 승격해 OS 강조색 포커스 링을 그린다 — 열리는 화면에
 * autoFocus 입력이 있으면 포커스를 뺏겨 안 생기고, 없으면(초대현황) 생기는 이유
 * (2026-09-03 실측). 근본 차단: 마우스 클릭 유래 포커스는 클릭이 끝나는 즉시 회수한다.
 * 키보드(Enter/Space) 활성화는 detail=0이라 건드리지 않는다 — Tab 포커스 흐름 무영향.
 */
export function MouseFocusReset() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return; // 키보드 유래 클릭 제외
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement) el.blur();
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);
  return null;
}

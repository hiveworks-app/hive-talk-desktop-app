'use client';

import { useEffect } from 'react';

/**
 * 마우스 X버튼(뒤로가기=3·앞으로가기=4)의 브라우저 히스토리 탐색 차단 — 루트 레이아웃 마운트.
 *
 * 주소창 없는 데스크톱 SPA에서 히스토리 임의 이동은 화면 상태와 어긋난다(로그인 가드
 * 이전 화면 복귀, 정적 export 초기 로드로의 회귀 등) — 슬랙·디스코드처럼 무시한다.
 * Chromium은 X버튼의 기본 동작(히스토리 이동)을 mouseup에서 수행하며 preventDefault를
 * 존중한다. capture 단계 + mousedown 병행은 플랫폼별 트리거 시점 편차 대비.
 * (윈도우의 WM_APPCOMMAND 경로는 electron/window.ts blockHistoryNavigation이 한 쌍, 2026-09-04)
 */
export function MouseNavGuard() {
  useEffect(() => {
    const blockNavButtons = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('mousedown', blockNavButtons, true);
    window.addEventListener('mouseup', blockNavButtons, true);
    return () => {
      window.removeEventListener('mousedown', blockNavButtons, true);
      window.removeEventListener('mouseup', blockNavButtons, true);
    };
  }, []);
  return null;
}

'use client';

import { useEffect } from 'react';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';

/**
 * 오버레이가 열려 있는 동안 Electron 메인의 ESC→창 숨김(before-input-event)을 억제한다.
 * escSuppress 참조 카운터를 React 수명주기에 묶은 편의 훅 — 닫히면(또는 언마운트) 자동 해제.
 * (2026-08-26 전수 감사: 억제 없는 다이얼로그에서 ESC가 앱 창을 트레이로 숨기던 문제)
 */
export function useEscSuppress(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireEscSuppress();
  }, [active]);
}

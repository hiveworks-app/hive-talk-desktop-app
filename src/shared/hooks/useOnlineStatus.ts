'use client';

import { useNetworkStatusStore } from '@/store/networkStatusStore';

/**
 * 온라인 여부 — 확정 오프라인(phase='offline')만 false (RN 패리티).
 * `navigator.onLine` 직결이던 시절엔 어댑터 전환 순간의 오탐으로 배너가 깜빡였다 —
 * 판정은 connectivityMonitor(유예+probe 검증)가 담당하고 여기선 결과만 구독한다.
 */
export function useOnlineStatus() {
  return useNetworkStatusStore(s => s.phase !== 'offline');
}

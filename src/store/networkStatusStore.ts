import { create } from 'zustand';

/**
 * 네트워크 상태 3상 스토어 (RN networkStatusStore 패리티).
 *
 * `navigator.onLine` 단일 신호를 그대로 쓰면 어댑터 전환 순간의 오탐으로 즉시
 * 배너·전송 차단이 걸린다 — 브라우저 offline 신호는 "의심"으로만 받고(verifying),
 * 유예 + 서버 probe 실패가 누적됐을 때만 offline으로 확정한다 (connectivityMonitor 참조).
 *
 * 소비자 노출 규칙: verifying은 아직 online으로 취급 — 오탐 구간에 사용자를 막지 않는다.
 */
export type NetworkPhase = 'online' | 'verifying' | 'offline';

interface NetworkStatusState {
  phase: NetworkPhase;
  setPhase: (phase: NetworkPhase) => void;
}

export const useNetworkStatusStore = create<NetworkStatusState>(set => ({
  phase: 'online',
  setPhase: phase => set({ phase }),
}));

/** 확정 오프라인 여부 — 가드/차단은 이 값 기준 (verifying은 online 취급) */
export const isEffectivelyOffline = () =>
  useNetworkStatusStore.getState().phase === 'offline';

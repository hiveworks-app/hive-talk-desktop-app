'use client';

import { useEffect } from 'react';
import { useNetworkStatusStore } from '@/store/networkStatusStore';

/**
 * 오프라인 "확정" 검증 모니터 (RN connectivityPolicy 패리티).
 *
 * - 브라우저 offline 신호 → verifying(소비자에겐 online 노출) → 5초 유예 후
 *   1초 간격 probe 3회 실패가 누적됐을 때만 offline 확정.
 * - 확정 후에는 5s→15s→30s 백오프로 재검사, probe 성공/브라우저 online 신호+probe 성공/
 *   WS open 중 하나로 즉시 online 복귀.
 * - probe는 HTTP 응답 수신 자체가 도달 증거 (401 등 상태 코드 무관 — RN 동일).
 */
const OFFLINE_GRACE_MS = 5_000;
const VERIFY_ATTEMPTS = 3;
const VERIFY_GAP_MS = 1_000;
const RECHECK_BACKOFF_MS = [5_000, 15_000, 30_000];
const PROBE_TIMEOUT_MS = 4_000;

let graceTimer: ReturnType<typeof setTimeout> | null = null;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;
let recheckIndex = 0;
let verifyRun = 0; // 진행 중 verify 무효화 토큰 (복귀 시 증가)

function clearTimers() {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (recheckTimer) {
    clearTimeout(recheckTimer);
    recheckTimer = null;
  }
}

async function probeServer(): Promise<boolean> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/app/push/settings`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return true; // HTTP 응답 수신 = 서버 도달 (상태 코드 무관)
  } catch {
    return false;
  }
}

/** 확실한 연결 증거(WS open·probe 성공) — 즉시 online 복귀 */
export function reportConnectivityRecovered() {
  verifyRun += 1;
  clearTimers();
  recheckIndex = 0;
  const { phase, setPhase } = useNetworkStatusStore.getState();
  if (phase !== 'online') setPhase('online');
}

function scheduleRecheck() {
  const delay = RECHECK_BACKOFF_MS[Math.min(recheckIndex, RECHECK_BACKOFF_MS.length - 1)];
  recheckIndex += 1;
  recheckTimer = setTimeout(() => {
    void probeServer().then(ok => {
      if (ok) reportConnectivityRecovered();
      else scheduleRecheck();
    });
  }, delay);
}

async function verifyOffline() {
  const run = verifyRun;
  for (let i = 0; i < VERIFY_ATTEMPTS; i += 1) {
    if (run !== verifyRun) return; // 이미 복귀함 — 진행 중 판정 폐기
    if (await probeServer()) {
      reportConnectivityRecovered();
      return;
    }
    if (i < VERIFY_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, VERIFY_GAP_MS));
    }
  }
  if (run !== verifyRun) return;
  useNetworkStatusStore.getState().setPhase('offline');
  scheduleRecheck();
}

function onBrowserOffline() {
  const { phase, setPhase } = useNetworkStatusStore.getState();
  if (phase !== 'online') return; // 이미 판정/확정 진행 중
  setPhase('verifying');
  graceTimer = setTimeout(() => {
    graceTimer = null;
    void verifyOffline();
  }, OFFLINE_GRACE_MS);
}

function onBrowserOnline() {
  // 어댑터 복귀 신호 — 낙관하지 않고 probe 성공으로 확정 복귀 (LAN만 연결된 오판 방지)
  void probeServer().then(ok => {
    if (ok) reportConnectivityRecovered();
  });
}

/** (main) 레이아웃에 1회 마운트 — 브라우저 신호를 3상 판정으로 변환한다 */
export function useConnectivityMonitor() {
  useEffect(() => {
    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('online', onBrowserOnline);
    return () => {
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('online', onBrowserOnline);
      clearTimers();
    };
  }, []);
}

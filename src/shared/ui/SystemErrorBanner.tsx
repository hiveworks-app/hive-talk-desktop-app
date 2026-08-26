'use client';

import { useEffect } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useSystemErrorStore } from '@/store/systemErrorStore';
import IconCaution from '@assets/icons/caution.svg';

const RECOVERY_PROBE_INTERVAL_MS = 25_000;
const PROBE_TIMEOUT_MS = 5_000;

/**
 * 시스템 오류(서버 장애) 배너 (RN SystemBanner system 변형 + useSystemErrorRecovery 패리티).
 * - 표시 중 25초 주기 + 창 포커스 복귀 시 probe — 5xx가 아닌 HTTP 응답을 받으면 해소.
 * - 오프라인 배너가 우선 — 동시에 최대 1개만 (RN useSystemBannerVisibility)
 */
export function SystemErrorBanner() {
  const isOnline = useOnlineStatus();
  const visible = useSystemErrorStore(s => s.visible);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/app/push/settings`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        // 5xx가 아니면(401 포함) 서버 정상 응답 — 장애 해소로 판정
        if (!cancelled && res.status < 500) useSystemErrorStore.getState().resolveAll();
      } catch {
        // 도달 불가 — 배너 유지 (오프라인 판정은 connectivityMonitor 소관)
      }
    };
    const interval = setInterval(() => void probe(), RECOVERY_PROBE_INTERVAL_MS);
    const onFocus = () => void probe();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [visible]);

  if (!visible || !isOnline) return null;

  return (
    <div className="absolute left-0 right-0 top-12 z-40 flex h-8 items-center justify-center gap-1 bg-gray-500 px-4 text-sub-lg text-white">
      <IconCaution width={16} height={16} />
      <span>일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</span>
    </div>
  );
}

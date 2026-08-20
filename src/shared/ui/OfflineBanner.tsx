'use client';

import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import IconCaution from '@assets/icons/caution.svg';

/**
 * 오프라인 배너 — RN SystemBanner(network 변형) 패리티.
 * 32px 높이, bg-gray-500, IconCaution 16px + sub-lg(15px) 흰 글자.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="absolute left-0 right-0 top-12 z-40 flex h-8 items-center justify-center gap-1 bg-gray-500 px-4 text-sub-lg text-white">
      <IconCaution width={16} height={16} />
      <span>네트워크 연결을 확인해주세요.</span>
    </div>
  );
}

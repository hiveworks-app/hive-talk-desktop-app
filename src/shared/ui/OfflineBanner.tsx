'use client';

import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { IconWifiOff } from '@/shared/ui/icons';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="absolute top-12 right-0 left-0 z-40 flex items-center justify-center gap-2 bg-gray-700 px-4 py-2 text-sub-sm text-white">
      <IconWifiOff size={14} />
      <span>오프라인 상태입니다. 인터넷 연결을 확인해 주세요.</span>
    </div>
  );
}

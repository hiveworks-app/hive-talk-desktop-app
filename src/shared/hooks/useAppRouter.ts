'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { isOffline } from '@/shared/utils/offlineGuard';

/**
 * 오프라인 상태에서 네비게이션을 차단하는 라우터 래퍼.
 * 오프라인 시 router.push / router.replace 호출을 막고 스낵바로 안내한다.
 */
export function useAppRouter() {
  const router = useRouter();

  const push = useCallback(
    (...args: Parameters<typeof router.push>) => {
      if (isOffline('오프라인 상태에서는 이동할 수 없습니다.')) return;
      router.push(...args);
    },
    [router],
  );

  const replace = useCallback(
    (...args: Parameters<typeof router.replace>) => {
      if (isOffline('오프라인 상태에서는 이동할 수 없습니다.')) return;
      router.replace(...args);
    },
    [router],
  );

  return useMemo(
    () => ({ ...router, push, replace }),
    [router, push, replace],
  );
}

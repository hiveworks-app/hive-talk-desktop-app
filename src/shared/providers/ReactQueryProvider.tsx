'use client';

import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { isEffectivelyOffline } from '@/store/networkStatusStore';
import { useEffect } from 'react';
import { registerLogoutCleanup } from '@/shared/utils/logoutCleanup';
import { useState, type ReactNode } from 'react';

/**
 * IndexedDB 기반 async storage adapter
 * idb-keyval은 ~1KB의 경량 IndexedDB wrapper로,
 * localStorage(5MB)와 달리 용량 제한이 사실상 없음
 */
const idbStorage = {
  getItem: async (key: string) => (await get<string>(key)) ?? null,
  setItem: async (key: string, value: string) => {
    await set(key, value);
  },
  removeItem: async (key: string) => {
    await del(key);
  },
};

const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'hiveworks-query-cache',
});

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onMutate: () => {
            // 확정 오프라인만 차단 (RN 패리티 — navigator 오탐으로 mutation이 막히지 않게)
            if (isEffectivelyOffline()) {
              throw new ApiError({ status: 0, message: '오프라인 상태에서는 사용할 수 없습니다.' });
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            gcTime: TWENTY_FOUR_HOURS,
            retry: 1,
            // 창 복귀·재연결 시 재검증 (RN 패리티) — WS 미수신 구간(블러/끊김)의 stale을
            // 복귀 시점에 맞춘다. false면 창을 다시 봐도 목록이 갱신되지 않았다 (2026-08-26 감사)
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            networkMode: 'offlineFirst',
          },
        },
      }),
  );

  // 로그아웃 시 캐시 일괄 정리 등록 — 호출 경로마다 정리 범위가 다르던 문제 통일 (RN 패리티)
  useEffect(() => {
    return registerLogoutCleanup(() => {
      queryClient.clear();
      void del('hiveworks-query-cache');
    });
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: TWENTY_FOUR_HOURS,
        dehydrateOptions: {
          shouldDehydrateQuery: query => query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

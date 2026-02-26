'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
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
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            gcTime: TWENTY_FOUR_HOURS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

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

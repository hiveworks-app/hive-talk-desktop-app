'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetTagCategoryList, apiGetTagList } from '@/features/tag/api';
import { TAG_CATEGORY_KEY, TAG_LIST_KEY } from '@/shared/config/queryKeys';
import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';
import { useAuthStore } from '@/store/auth/authStore';
import { useAutoUpdate } from '@/shared/hooks/useAutoUpdate';
import { OfflineBanner } from '@/shared/ui/OfflineBanner';

const TAG_STALE_TIME = 1000 * 60 * 60 * 24; // 24시간

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);

  // Zustand persist 복원 완료 후 인증 확인 + 태그 prefetch
  useEffect(() => {
    const check = () => {
      if (!useAuthStore.getState().accessToken) {
        router.replace('/login');
        return;
      }
      setAuthChecked(true);

      // 태그 데이터 prefetch (변경되지 않는 데이터이므로 로그인 시 미리 캐싱)
      queryClient.prefetchQuery({
        queryKey: [TAG_CATEGORY_KEY],
        queryFn: async () => (await apiGetTagCategoryList()).payload.items,
        staleTime: TAG_STALE_TIME,
      });
      queryClient.prefetchQuery({
        queryKey: [TAG_LIST_KEY],
        queryFn: async () => (await apiGetTagList()).payload.items,
        staleTime: TAG_STALE_TIME,
      });
    };

    if (useAuthStore.persist.hasHydrated()) {
      check();
    } else {
      useAuthStore.persist.onFinishHydration(check);
    }
  }, []);

  // 로그아웃 시 로그인 페이지로 이동
  useEffect(() => {
    if (authChecked && !accessToken) {
      router.replace('/login');
    }
  }, [authChecked, accessToken]);

  const { updateReady, installUpdate } = useAutoUpdate();

  if (!authChecked) return null;

  return (
    <WebSocketProvider>
      <div className="relative flex h-full overflow-hidden">
        <OfflineBanner />
        {updateReady && (
          <div className="absolute right-0 bottom-0 left-0 z-50 flex items-center justify-center gap-3 bg-blue-500 px-4 py-2 text-sm text-white">
            <span>v{updateReady.version} 업데이트가 준비되었습니다.</span>
            <button
              onClick={installUpdate}
              className="rounded bg-white px-3 py-1 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-50"
            >
              재시작
            </button>
          </div>
        )}
        <AppNav />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WebSocketProvider>
  );
}

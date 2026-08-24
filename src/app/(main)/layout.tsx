'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DuplicateLoginLogoutDialog } from '@/features/auth/ui/DuplicateLoginLogoutDialog';
import { ExternalInviteArrivalNotice } from '@/features/external-member/ExternalInviteArrivalNotice';
import { MemberInviteConfirm } from '@/features/member-invite/MemberInviteConfirm';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useMembersAutoRefresh } from '@/features/members/useMembersAutoRefresh';
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
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);
  // 차단 목록 상시 조회 — cold start baseline 확보 + 스토어 write-through (결과 미사용, RN useMembersAutoRefresh 패리티)
  useGetBlockedMembers();
  // 멤버목록·관심멤버 5분 자동 갱신 (RN 패리티)
  useMembersAutoRefresh();

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
        {/* 섹션(채팅↔멤버↔설정) 전환 시에만 페이드 — 같은 섹션 내 이동(방 전환 등)은 무애니메이션 */}
        <div key={pathname.split('/')[1] ?? ''} className="animate-page-in flex min-w-0 flex-1">
          {children}
        </div>
        {/* 중복 로그인 강제 종료 안내 — 화면 전환과 무관하게 확인 전까지 유지 (RN 루트 Portal 패리티) */}
        <DuplicateLoginLogoutDialog />
        {/* 협력멤버 초대장 도착 안내 (RN 패리티) */}
        <ExternalInviteArrivalNotice />
        {/* 사내(소속) 초대 수락/거절 (RN 패리티) */}
        <MemberInviteConfirm />
      </div>
    </WebSocketProvider>
  );
}

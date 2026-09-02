'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BootScreen } from '@/shared/ui/BootScreen';
import { DuplicateLoginLogoutDialog } from '@/features/auth/ui/DuplicateLoginLogoutDialog';
import { ExternalInviteArrivalNotice } from '@/features/external-member/ExternalInviteArrivalNotice';
import { MemberInviteConfirm } from '@/features/member-invite/MemberInviteConfirm';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useGetPushSettings } from '@/features/notification-settings/queries';
import { useConnectivityMonitor } from '@/shared/network/connectivityMonitor';
import { useMembersAutoRefresh } from '@/features/members/useMembersAutoRefresh';
import { apiGetTagCategoryList, apiGetTagList } from '@/features/tag/api';
import { TAG_CATEGORY_KEY, TAG_LIST_KEY } from '@/shared/config/queryKeys';
import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';
import { useAuthStore } from '@/store/auth/authStore';
import { useAutoUpdate } from '@/shared/hooks/useAutoUpdate';
import { OfflineBanner } from '@/shared/ui/OfflineBanner';
import { SystemErrorBanner } from '@/shared/ui/SystemErrorBanner';

const TAG_STALE_TIME = 1000 * 60 * 60 * 24; // 24시간

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);
  // 차단 목록 상시 조회 — cold start baseline 확보 + 스토어 write-through (결과 미사용, RN useMembersAutoRefresh 패리티)
  useGetBlockedMembers();
  // 푸시 설정 상시 로드 — 알림 게이트(handlePublish 등)가 이 캐시를 직접 읽는다. 설정 화면 진입
  // 시에만 로드하면 콜드스타트에서 캐시가 비어 "알림 OFF"가 무시된다 (RN usePushSettingsSync 패리티)
  useGetPushSettings();
  // 오프라인 확정 검증 — navigator.onLine 오탐을 유예+probe로 걸러 3상 판정 (RN connectivityPolicy 패리티)
  useConnectivityMonitor();
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

  const { updateReady, installUpdate, isInstalling } = useAutoUpdate();

  // 인증 체크 동안 null 렌더 = 빈 흰 창 — 스플래시와 이어지는 브랜드 로딩으로 채운다 (2026-09-02)
  if (!authChecked) return <BootScreen />;

  return (
    <WebSocketProvider>
      <div className="relative flex h-full overflow-hidden">
        <OfflineBanner />
        <SystemErrorBanner />
        {updateReady && (
          <div className="absolute right-0 bottom-0 left-0 z-50 flex items-center justify-center gap-3 bg-blue-500 px-4 py-2 text-sm text-white">
            <span>v{updateReady.version} 업데이트가 준비되었습니다.</span>
            <button
              onClick={installUpdate}
              disabled={isInstalling}
              className="rounded bg-white px-3 py-1 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-50 disabled:opacity-70"
            >
              {isInstalling ? '적용 중…' : '재시작'}
            </button>
          </div>
        )}
        {/* 업데이트 적용 안내 — 종료→교체(NSIS 진행 창)→재실행 흐름의 예고.
            스플래시와 동일한 시각 언어(로고+스피너)로 부팅 화면과 한 흐름으로 읽히게 (2026-09-02) */}
        {isInstalling && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white">
            <img src="/hivetalk-login-logo.png" alt="" className="h-[72px] w-[72px] object-contain" />
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-500" />
            <p className="text-body font-medium text-text-primary">업데이트를 적용하고 있어요</p>
            <p className="text-sub-sm text-text-secondary">곧 적용 화면이 표시되고, 완료되면 자동으로 다시 시작됩니다.</p>
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

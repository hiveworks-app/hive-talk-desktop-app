'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMembers } from '@/features/members/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { MEMBERS_REFRESH_INTERVAL_MS } from '@/shared/config/constants';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';
import { useSessionDisconnectStore } from '@/store/auth/sessionDisconnectStore';

/**
 * 멤버목록 + 관심멤버 5분 자동 갱신 (RN useMembersAutoRefresh 패리티).
 *
 * RN은 "마운트 + 앱 foreground 복귀" 시점에만 경과를 판정하지만, 데스크톱은 포커스를
 * 유지한 채 장시간 켜두는 사용 패턴이 지배적이라 setInterval 주기 체크를 추가한다
 * (staleTime 4h + refetchOnWindowFocus:false 환경에서 신규 입사자·협력멤버가
 * 최대 4시간 안 보이던 문제 해소). 마지막 동기화 시각은 SQLite 대신
 * React Query의 MEMBERS_KEY dataUpdatedAt을 사용한다.
 */
export function useMembersAutoRefresh() {
  const queryClient = useQueryClient();
  const { refetch: refetchMembers } = useGetMembers();
  const { refetch: refetchPinnedMembers } = useGetPinnedMembers();

  useEffect(() => {
    const refreshIfNeeded = async () => {
      // 로그인되지 않은 상태에서는 refetch 호출 자체를 막아 인증 헤더 없는 401 요청을 차단
      // (React Query의 enabled 옵션은 명령형 refetch()를 막지 못한다)
      if (!useAuthStore.getState().accessToken) return;
      // 중복 로그인 안내(SC010) 유예 중에는 인증이 이미 무효 — fetch가 401→refresh 거절만
      // 반복하므로 차단한다. 로그아웃은 다이얼로그 확인 시점에 수행된다.
      if (useSessionDisconnectStore.getState().noticeVisible) return;

      const lastSyncedAt = queryClient.getQueryState(MEMBERS_KEY)?.dataUpdatedAt ?? 0;
      if (lastSyncedAt && Date.now() - lastSyncedAt < MEMBERS_REFRESH_INTERVAL_MS) return;

      await refetchMembers();
      await refetchPinnedMembers();
    };

    // 1) 마운트 시 1회 + 5분 주기 체크
    void refreshIfNeeded();
    const interval = setInterval(() => void refreshIfNeeded(), MEMBERS_REFRESH_INTERVAL_MS);

    // 2) 창 포커스/가시성 복귀 시 체크 (RN AppState 'active' 대응)
    const onFocus = () => void refreshIfNeeded();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshIfNeeded();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [queryClient, refetchMembers, refetchPinnedMembers]);
}

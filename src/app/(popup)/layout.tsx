'use client';

import { useEffect, useState } from 'react';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useGetMembers } from '@/features/members/queries';
import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { useAuthStore } from '@/store/auth/authStore';

/**
 * 멀티 채팅창(팝업) 전용 레이아웃 — 대화 화면 하나만 담는 경량 셸.
 *
 * (main) 레이아웃과 의도적으로 분리한다: 좌측 네비·전역 안내 다이얼로그(중복 로그인·초대 도착·
 * 사내 초대)·자동 업데이트 배너를 띄우면 "앱이 하나 더 뜬 것"처럼 보이기 때문.
 * 채팅방 동작에 실제로 필요한 것만 마운트한다:
 * - WebSocketProvider: 메시지 송수신 (창마다 독립 소켓)
 * - 차단 목록: 차단 발신자 메시지 접힘 판정 + blockedMembersStore write-through
 * - 멤버 목록: 말풍선 프로필 열기가 MEMBERS_KEY 캐시를 읽음 (없으면 전부 '미등록' 처리됨)
 *
 * 로그인 상태는 localStorage(zustand persist)가 창 간 공유되므로 그대로 이어진다.
 */
export default function PopupLayout({ children }: { children: React.ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    void (async () => {
      // persist 자동 복원 타이밍에 의존하지 않고 명시적으로 재수화한다.
      // 팝업은 새 렌더러라 첫 렌더가 빨라 자동 복원 완료 전에 effect가 돌 수 있고,
      // 그 경우 hasHydrated()/onFinishHydration만으로는 토큰을 놓친다.
      await useAuthStore.persist.rehydrate();

      // 팝업은 로그인 화면으로 보내지도, 창을 닫지도 않는다 — 닫으면 원인이 남지 않는다
      if (useAuthStore.getState().accessToken) {
        setAuthChecked(true);
        return;
      }
      const hasRaw = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('user-auth'));
      console.warn('[popup] 세션 없음 — localStorage user-auth 존재 여부:', hasRaw);
      setNoSession(true);
    })();
  }, []);

  if (noSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <span className="text-body font-medium text-text-primary">채팅방을 열지 못했어요.</span>
        <span className="text-sub-sm text-text-secondary">로그인 정보를 찾을 수 없어요.</span>
      </div>
    );
  }

  // 인증 확인 + 방 부트스트랩 동안 빈 흰 화면 대신 스피너 (앱 공통 32px 링)
  if (!authChecked) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-400" />
      </div>
    );
  }

  return (
    <WebSocketProvider>
      <PopupDataBootstrap />
      <div className="flex h-full overflow-hidden">{children}</div>
    </WebSocketProvider>
  );
}

/** 채팅방 렌더에 필요한 캐시만 채우는 마운트 전용 컴포넌트 (UI 없음) */
function PopupDataBootstrap() {
  useGetBlockedMembers();
  useGetMembers();
  return null;
}

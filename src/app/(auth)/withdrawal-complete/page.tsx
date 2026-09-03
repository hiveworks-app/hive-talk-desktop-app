'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useAuthStore } from '@/store/auth/authStore';
import { Button } from '@/shared/ui/Button';

/**
 * 하이브톡 탈퇴 완료 화면 (RN WithdrawalCompleteScreen 패리티, 정책 settings.md
 * "탈퇴 완료 후 로그인 페이지로 이동").
 *
 * (auth) 그룹 = 인증 가드 밖 — RN이 완료 화면을 루트 레벨에 둔 것과 같은 이유다.
 * 로컬 세션 정리는 이 화면 마운트 시점에 한다: (main) 안에서 logout하면 가드 effect가
 * /login 이동과 경합해 이 화면이 스킵된다 (2026-09-03 자동 이동 버그). Next는 라우트
 * 그룹 전환 시 (main) 레이아웃이 언마운트되므로 RN의 전환 겹침 문제는 없다.
 */
export default function WithdrawalCompletePage() {
  const router = useAppRouter();

  // 서버 세션은 탈퇴로 이미 소멸 — 로컬(토큰·캐시)도 즉시 정리해 강제 로그아웃 트리거
  // (토큰 기반 요청·WS 재연결) 자체를 없앤다
  useEffect(() => {
    useAuthStore.getState().logout();
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-12 pb-6 text-center">
        <div className="flex flex-col items-center gap-5">
          {/* 체크 뱃지 — RN ChangeEmailCompleteScreen 동일 패턴 (blue-100 배경 + primary 체크) */}
          <div className="flex size-[50px] items-center justify-center rounded-full bg-blue-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-heading-lg font-semibold text-text-primary">하이브톡 탈퇴 완료</h3>
            <p className="text-sub text-text-secondary">하이브톡을 이용해 주셔서 감사합니다.</p>
          </div>
        </div>
        {/* RN Button size lg 대응 — 데스크톱 표준 lg(48px) */}
        <Button size="lg" fullWidth onClick={() => router.replace('/login')}>
          로그인 페이지로 가기
        </Button>
      </div>
    </main>
  );
}

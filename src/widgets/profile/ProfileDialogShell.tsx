'use client';

import { useEffect, type ReactNode } from 'react';

interface ProfileDialogShellProps {
  title: string;
  onClose: () => void;
  /** 헤더 우측 부가 액션(협력멤버 케밥 등) — 닫기(✕) 왼쪽에 노출 */
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * 프로필 모달 공용 골격 (내 프로필 / 사내멤버 / 협력멤버 공통).
 *
 * 모바일은 풀스크린 페이지(상태바 + 뒤로가기 TopBar)지만, 데스크톱에선 중앙 모달로 변환한다.
 * - 뒤로가기(←) → 닫기(✕)
 * - 우측 부가 액션(별/케밥)은 headerRight 슬롯으로 주입
 * - 타이틀은 모바일 패리티를 위해 중앙 정렬
 */
export function ProfileDialogShell({ title, onClose, headerRight, children }: ProfileDialogShellProps) {
  // Esc 키로 닫기 — 외부 시스템(키보드 이벤트)과의 동기화 목적의 useEffect
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[400px] rounded-xl bg-background shadow-2xl">
        {/* 헤더: 타이틀 중앙, 우측에 부가 액션 + 닫기 */}
        <div className="relative flex items-center justify-center border-b border-divider px-5 py-4">
          <h2 className="text-heading-sm font-bold text-text-primary">{title}</h2>
          <div className="absolute right-3 flex items-center gap-0.5">
            {headerRight}
            <button
              onClick={onClose}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';

/**
 * 오버레이/풀스크린 화면의 ESC 3종 세트 — active인 동안:
 * ① Electron 메인의 ESC→트레이 숨김 억제 (없으면 닫히는 순간 앱 창도 같이 숨는다)
 * ② 오버레이 스택 등록 — 겹침 시 최상단만 닫기
 * ③ ESC keydown → onClose (위층 Radix가 소비한 defaultPrevented ESC는 무시)
 *
 * 기존 오버레이들(ProfileDialogShell·검색 3종 등)에 산재하던 동일 패턴의 공용화 —
 * 닫기 버튼이 있는 화면은 ESC로도 그 화면만 닫혀야 한다 (2026-09-03 전수 감사).
 */
export function useEscClose(active: boolean, onClose: () => void) {
  // onClose는 대개 인라인 클로저(매 렌더 새 참조) — effect 의존성에 두면 부모 리렌더마다
  // 스택이 재등록돼 겹침 순서가 깨진다. ref로 최신만 유지 (ProfileDialogShell과 동일 규칙)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const overlay = pushOverlay();
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && overlay.isTop()) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      release();
      overlay.release();
    };
  }, [active]);
}

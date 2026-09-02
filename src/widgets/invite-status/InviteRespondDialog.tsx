'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import { useDimmed } from '@/shared/hooks/useDimmed';

interface InviteRespondDialogProps {
  name: string;
  /** 진행 중인 응답 — 해당 버튼에 스피너 표시 + 양쪽 비활성 */
  respondingAction: 'ACCEPT' | 'REJECTED' | null;
  onReject: () => void;
  onAccept: () => void;
  onClose: () => void;
}

/**
 * 받은 초대 응답 다이얼로그 — RN은 바텀시트지만 데스크톱 관례에 맞게 중앙 모달로.
 * 카피·버튼 구성(거절/수락, 처리 중 스피너+다이얼로그 유지)은 RN과 동일.
 * 딤 탭/ESC = 그냥 닫힘(응답 아님), 처리 중에는 닫기 불가.
 */
export function InviteRespondDialog({ name, respondingAction, onReject, onAccept, onClose }: InviteRespondDialogProps) {
  const isLoading = respondingAction !== null;
  // 어두운 스크림 → 창 버튼(WCO) 딤 동기화 — 열릴 때만 마운트되므로 상시 (2026-09-02 윈도우 실측 누락분)
  useDimmed(true);

  const isLoadingRef = useRef(isLoading);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    isLoadingRef.current = isLoading;
    onCloseRef.current = onClose;
  }, [isLoading, onClose]);

  // ESC = 다이얼로그만 닫기 (아래 초대현황 화면은 유지 — overlayStack 최상단 판별)
  useEffect(() => {
    const overlay = pushOverlay();
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && overlay.isTop() && !isLoadingRef.current) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      release();
      overlay.release();
    };
  }, []);

  // body 직속 포털 — 풀스크린 오버레이(z-50 포털)보다 항상 위에 오도록 (z-[80])
  return createPortal(
    <div className="electron-no-drag fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className="animate-fade-in-fast absolute inset-0 bg-black/30"
        onClick={isLoading ? undefined : onClose}
      />
      <div
        className="animate-pop-in relative z-10 w-[320px] rounded-xl bg-white p-6"
        role="alertdialog"
        aria-label="멤버초대 응답"
      >
        <div className="flex flex-col gap-2">
          <p className="text-heading-md font-semibold text-gray-900">
            {name}님 멤버초대를 수락하시겠습니까?
          </p>
          <p className="text-sub-lg text-gray-700">수락하면 멤버로 추가되며, 대화를 시작할 수 있어요.</p>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            disabled={isLoading}
            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-gray-100 text-body font-medium text-gray-600 transition-colors hover:bg-gray-200 active:opacity-60"
          >
            {respondingAction === 'REJECTED' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              '거절'
            )}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isLoading}
            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-body font-medium text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] active:opacity-60"
          >
            {respondingAction === 'ACCEPT' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              '수락'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

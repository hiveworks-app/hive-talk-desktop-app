'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import IconArrowBack from '@assets/icons/arrow_back.svg';
import IconCloseStroke from '@assets/icons/close-stroke.svg';

interface ProfileDialogShellProps {
  title: string;
  onClose: () => void;
  /** 좌측 아이콘 — 'back'(←, 기본) 또는 'close'(✕: RN 멤버초대/초대현황 헤더 대응) */
  leftIcon?: 'back' | 'close';
  /** 헤더 우측 부가 액션(별/케밥/완료 등) — RN ScreenHeader right 슬롯 대응 */
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * 프로필 풀스크린 오버레이 골격 (내 프로필 / 멤버 프로필 / 프로필 수정 공통).
 *
 * RN 스크린 구조 패리티 (MyProfileScreen / UserProfileScreen):
 * - gray-50 배경 + ScreenHeader(52px, ← 뒤로가기 · 중앙 타이틀 · 우측 액션)
 * - 본문은 흰색 rounded-t-2xl 카드가 화면 하단까지 채움
 * - ESC = 뒤로가기(←)와 동일. 열려 있는 동안 Electron ESC→창 숨김을 억제하고,
 *   위에 열린 미디어 뷰어가 소비한(preventDefault) ESC는 무시한다.
 */
export function ProfileDialogShell({ title, onClose, leftIcon = 'back', headerRight, children }: ProfileDialogShellProps) {
  // onClose는 대개 인라인 클로저(매 렌더 새 참조)라 effect 의존성에 두면
  // 부모 리렌더마다 오버레이 스택이 재등록돼 겹침 순서가 깨진다 — ref로 최신만 유지.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const overlay = pushOverlay();
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      // 겹침 시 최상단 오버레이만 닫기 + 위층(미디어 뷰어)이 소비한 ESC 무시
      if (e.key === 'Escape' && !e.defaultPrevented && overlay.isTop()) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      release();
      overlay.release();
    };
  }, []);

  // 조상 DOM의 스택 컨텍스트 간섭 배제 — body 직속 포털 (멤버목록 편집과 동일 패턴).
  // electron-no-drag: 아래 깔린 페이지 헤더의 창 드래그 영역이 오버레이 위 클릭을 삼키지
  // 않도록 전체 화면을 no-drag로 뚫는다 (창 이동은 내부 드래그 바가 다시 제공).
  // 주의: 등장 애니메이션(transform)은 반드시 내부 래퍼에만 — no-drag 루트가 움직이면
  // 드래그 영역 구멍이 첫 프레임의 밀린 위치로 등록돼 좌측 버튼 클릭이 죽는다.
  return createPortal(
    <div className="electron-no-drag fixed inset-0 z-50">
      <div className="animate-overlay-in flex h-full flex-col bg-gray-50">
      {/* macOS 신호등 영역 확보용 드래그 바 */}
      <div className="electron-drag h-8 w-full shrink-0" />

      {/* ScreenHeader 패리티 — 52px, 타이틀은 화면 정중앙 고정(absolute), 좌/우 액션은 px-4 */}
      <div className="relative h-[52px] shrink-0">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[100px]">
          <h2 className="truncate text-heading-md font-medium text-text-primary">{title}</h2>
        </div>
        <div className="flex h-full items-center justify-between px-4">
          {/* 데스크톱 어포던스 — hover 디밍(opacity-70) + 클릭 순간(active) opacity-60 */}
          <button
            type="button"
            onClick={onClose}
            aria-label={leftIcon === 'close' ? '닫기' : '뒤로가기'}
            className="z-10 flex h-8 w-8 items-center justify-center text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          >
            {leftIcon === 'close' ? (
              // ✕는 획이 사방으로 뻗어 같은 크기여도 ←보다 커 보임 — 20px로 시각 균형 (히트영역 32px 동일)
              <IconCloseStroke width={20} height={20} />
            ) : (
              <IconArrowBack width={24} height={24} />
            )}
          </button>
          <div className="z-10 flex items-center gap-0.5">{headerRight}</div>
        </div>
      </div>

      {/* 흰색 카드 영역 (RN rounded-t-2xl + page shadow) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {/* 콘텐츠가 세로 중앙 정렬(flex-1 justify-center)될 수 있도록 최소 높이 보장 */}
          <div className="flex min-h-full flex-col">{children}</div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

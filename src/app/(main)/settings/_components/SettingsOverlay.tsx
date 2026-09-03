'use client';

import { useEscClose } from '@/shared/hooks/useEscClose';
import { useTitleBarColor } from '@/shared/hooks/useTitleBarColor';

interface SettingsOverlayProps {
  children: React.ReactNode;
  /** 배경색 유틸 클래스 (기본 bg-gray-50). */
  bg?: string;
  /** ESC 시 실행할 뒤로가기/닫기 — 화면의 ← 버튼과 동일 동작을 전달할 것.
   *  미전달 시 ESC는 Electron 기본(트레이 숨김)으로 흘러간다 (2026-09-03 전수 감사). */
  onEscape?: () => void;
}

// bg 유틸 클래스 → 실제 hex (globals.css 토큰 값) — Windows 타이틀바 버튼 영역 동기화용
const BG_HEX: Record<string, string> = {
  'bg-gray-50': '#F8F9FA',
  'bg-background': '#FFFFFF',
  'bg-surface': '#FFFFFF',
};

/**
 * 설정 상세 화면용 전체창 오버레이.
 *
 * fixed inset-0 z-50으로 좌측 AppNav까지 덮어 풀스크린 포커스 화면을 만든다
 * (모바일의 풀스크린 push 대응). 상단 electron-drag 스트립은 오버레이가
 * macOS 신호등 영역을 가려도 창 드래그가 가능하도록 보존한다.
 */
export function SettingsOverlay({ children, bg = 'bg-gray-50', onEscape }: SettingsOverlayProps) {
  // Windows 타이틀바 버튼 영역이 화면 상단(gray-50 등)과 어긋나 흰 네모로 뜨지 않게 동기화
  useTitleBarColor(BG_HEX[bg] ?? '#FFFFFF');
  // ESC = ← 뒤로가기와 동일 — 억제 없으면 ESC가 앱 창을 트레이로 숨긴다
  useEscClose(!!onEscape, onEscape ?? (() => {}));
  // electron-no-drag 루트는 정적으로 고정, 등장 애니메이션(transform)은 내부 래퍼에만 —
  // no-drag 루트가 움직이면 창 드래그 영역 구멍이 첫 프레임의 밀린 위치로 등록돼
  // 좌측 상단(뒤로가기 등) 클릭이 죽는다.
  return (
    <div className="electron-no-drag fixed inset-0 z-50">
      <div className={`animate-overlay-in flex h-full flex-col ${bg}`}>
        <div className="electron-drag h-8 w-full shrink-0" />
        {children}
      </div>
    </div>
  );
}

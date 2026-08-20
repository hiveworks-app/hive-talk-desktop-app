'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';

export interface CursorMenuItem {
  label: string;
  /** 라벨 앞 아이콘 (20px 권장 — 케밥 메뉴와 동일 체계). 색은 호출부에서 지정 */
  icon?: ReactNode;
  /** 위험 액션(나가기·차단 등) — 빨간 텍스트 */
  danger?: boolean;
  /**
   * 항목 선택 시 실행. 메뉴는 자동으로 닫히지 않으므로 핸들러가 닫기를 결정한다
   * (예: 즉시 액션이면 닫고 실행, 컨펌이 이어지면 메뉴만 교체).
   */
  onSelect: () => void;
}

interface CursorMenuProps {
  /** 뷰포트 기준 커서 좌표 (onContextMenu의 clientX/clientY) */
  x: number;
  y: number;
  items: CursorMenuItem[];
  /** 바깥 클릭/ESC로 닫기 */
  onClose: () => void;
}

const MENU_WIDTH = 160; // w-40
const ROW_HEIGHT = 40; // h-10

/**
 * 우클릭 컨텍스트 메뉴 (데스크톱 관례 — 목록 행 등에서 사용).
 * 커서 좌표에 열리고 바깥 클릭/우클릭/ESC로 닫힌다. 크기가 고정 규격이라
 * 렌더 전에 뷰포트 클램프를 계산한다 (마운트는 항상 클라이언트 상호작용 이후).
 */
export function CursorMenu({ x, y, items, onClose }: CursorMenuProps) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ESC = 메뉴만 닫기 (아래 풀스크린 오버레이는 유지 — overlayStack 최상단 판별)
  useEffect(() => {
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
  }, []);

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const menuHeight = items.length * ROW_HEIGHT;
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  return createPortal(
    <div
      className="electron-no-drag fixed inset-0 z-[90]"
      onMouseDown={onClose}
      onContextMenu={e => {
        e.preventDefault();
        onClose();
      }}
    >
      {/* overflow-hidden — 상하 패딩 없이 첫/마지막 행 hover 배경이 라운드 모서리까지 차도록 클리핑 */}
      <div
        role="menu"
        className="absolute w-40 overflow-hidden rounded-xl bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)]"
        style={{ left, top }}
        onMouseDown={e => e.stopPropagation()}
      >
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={item.onSelect}
            className={cn(
              'flex h-10 w-full items-center gap-1.5 border-b border-gray-100 px-3 text-body transition-colors last:border-b-0 hover:bg-gray-50',
              item.danger ? 'text-state-error' : 'text-gray-900',
            )}
          >
            {item.icon && <span className="flex shrink-0 items-center justify-center">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

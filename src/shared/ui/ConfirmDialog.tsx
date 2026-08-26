'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 타이틀 뒤 회색 보조 텍스트 — RN titleSuffix 패리티 (예: 방 이름 뒤 인원수) */
  titleSuffix?: string;
  description?: ReactNode;
  /** 확인 버튼 라벨 (기본: 확인) */
  confirmLabel?: string;
  /** 취소 버튼 라벨 (기본: 취소) */
  cancelLabel?: string;
  /** 위험 동작(삭제 등) — 확인 버튼을 빨강(state-error)으로 */
  destructive?: boolean;
  /** 어두운색 강조 동작(차단 등) — 확인 버튼을 진회색(gray-700)으로 (RN neutral, Figma 3105:143335) */
  neutral?: boolean;
  onConfirm: () => void;
  /** 취소 또는 오버레이/Esc로 닫을 때 */
  onCancel: () => void;
  /** false면 딤/ESC로 닫히지 않는다 — 버튼 응답 강제 (RN closeOnBackdropPress:false 대응.
      예: 사내 초대 수락/거절 — 딤 클릭이 곧 거절 API가 되면 회피 불가 오조작이 된다) */
  dismissible?: boolean;
}

/**
 * 공용 확인 다이얼로그 (Figma "Dialog" 공용 컴포넌트 패리티).
 * window.confirm 대체용 — 제목/설명 + 취소/확인 2버튼. 라벨·위험도는 호출부에서 주입한다.
 * 다른 모달 위에도 뜰 수 있도록 z-[60]/z-[70]을 사용한다.
 */
export function ConfirmDialog({
  open,
  title,
  titleSuffix,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  neutral = false,
  onConfirm,
  onCancel,
  dismissible = true,
}: ConfirmDialogProps) {
  // 열려 있는 동안 Electron ESC→창 숨김 억제 (ESC는 Radix가 다이얼로그 닫기로 소비)
  useEscSuppress(open);
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next && dismissible) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-dim fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content className="motion-center-pop fixed left-1/2 top-1/2 z-[70] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-xl focus:outline-none">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              {/* RN Confirm 패리티 — 타이틀 heading-md semibold, 설명 sub-lg gray-700 */}
              <Dialog.Title className="text-heading-md font-semibold text-text-primary">
                {title}
                {titleSuffix && <span className="text-gray-400"> {titleSuffix}</span>}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sub-lg text-gray-700">
                  {description}
                </Dialog.Description>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* RN Confirm 버튼 패리티 — 취소 bg-gray-100/gray-600, 확인 primary·destructive·neutral 3변형 */}
              <button
                type="button"
                onClick={onCancel}
                className="h-9 flex-1 rounded-[10px] bg-gray-100 text-body font-medium text-gray-600 transition-colors hover:bg-gray-200 active:bg-gray-200"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  'h-9 flex-1 rounded-[10px] text-body font-medium text-white transition-colors',
                  destructive
                    ? 'bg-state-error hover:bg-state-error-pressed active:bg-state-error-pressed'
                    : neutral
                      ? 'bg-gray-700 hover:bg-gray-800 active:bg-gray-800'
                      : 'bg-primary text-on-primary hover:bg-[var(--color-state-primary-pressed)] active:bg-[var(--color-state-primary-pressed)]',
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

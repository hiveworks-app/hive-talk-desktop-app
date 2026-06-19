'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** 확인 버튼 라벨 (기본: 확인) */
  confirmLabel?: string;
  /** 취소 버튼 라벨 (기본: 취소) */
  cancelLabel?: string;
  /** 위험 동작(삭제 등) — 확인 버튼을 빨강(state-error)으로 */
  destructive?: boolean;
  onConfirm: () => void;
  /** 취소 또는 오버레이/Esc로 닫을 때 */
  onCancel: () => void;
}

/**
 * 공용 확인 다이얼로그 (Figma "Dialog" 공용 컴포넌트 패리티).
 * window.confirm 대체용 — 제목/설명 + 취소/확인 2버튼. 라벨·위험도는 호출부에서 주입한다.
 * 다른 모달 위에도 뜰 수 있도록 z-[60]/z-[70]을 사용한다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-xl focus:outline-none">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <Dialog.Title className="text-[18px] font-semibold leading-[26px] tracking-[-0.18px] text-text-primary">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-[15px] leading-[22px] tracking-[-0.15px] text-text-secondary">
                  {description}
                </Dialog.Description>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-12 flex-1 rounded-[10px] bg-surface-pressed text-[16px] font-medium text-text-secondary transition-colors hover:bg-outline"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  'h-12 flex-1 rounded-[10px] text-[16px] font-medium text-white transition-colors',
                  destructive
                    ? 'bg-state-error hover:bg-state-error-pressed'
                    : 'bg-primary text-on-primary hover:bg-[var(--color-state-primary-pressed)]',
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

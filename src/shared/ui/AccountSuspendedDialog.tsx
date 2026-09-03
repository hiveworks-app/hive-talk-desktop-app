'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { AccountSuspendedPayload } from '@/shared/types/account';
import { Button } from '@/shared/ui/Button';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';

const SUPPORT_EMAIL = 'dawin@dawinsolution.co.kr';

interface AccountSuspendedDialogProps {
  open: boolean;
  /** 정지 상세. null이면 상세 없이 일반 안내만 표시 */
  info: AccountSuspendedPayload | null;
  onClose: () => void;
}

/**
 * 계정 정지 안내 — RN AccountSuspendedModal 카피 패리티.
 * 닫기는 '확인' 버튼으로만 가능 (정지 안내는 명시적 확인 필요 — 오버레이/ESC 무시).
 */
export function AccountSuspendedDialog({ open, info, onClose }: AccountSuspendedDialogProps) {
  useDimmed(open);
  // ESC-닫기가 막힌 모달이므로 떠 있는 동안 ESC는 완전 no-op — 억제 없으면 메인이 창만 숨긴다
  useEscSuppress(open);
  const periodText = info
    ? info.permanent
      ? '영구 정지'
      : `${info.suspendedAt}~${info.suspendedUntil}`
    : null;
  const descriptionText = [
    info ? `사유: 운영정책 위반 ${info.violationCount}건` : '사유: 운영정책 위반',
    ...(periodText ? [periodText] : []),
    '자세한 내용은 운영팀에게 문의해주세요.',
    `(${SUPPORT_EMAIL})`,
  ].join('\n');

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-dim fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="motion-center-pop fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl focus:outline-none"
          onEscapeKeyDown={e => e.preventDefault()}
          onPointerDownOutside={e => e.preventDefault()}
          onInteractOutside={e => e.preventDefault()}
        >
          <Dialog.Title className="text-heading-md font-semibold text-text-primary">
            계정이 정지 되었어요.
          </Dialog.Title>
          <Dialog.Description className="mt-2 whitespace-pre-line text-sub-lg text-gray-700">
            {descriptionText}
          </Dialog.Description>

          <div className="mt-3.5">
            <Button variant="primary" size="md" fullWidth onClick={onClose}>
              확인
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

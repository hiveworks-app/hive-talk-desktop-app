'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { AccountSuspendedPayload } from '@/shared/types/account';
import { Button } from '@/shared/ui/Button';

interface AccountSuspendedDialogProps {
  open: boolean;
  /** 정지 상세. null이면 상세 없이 일반 안내만 표시 */
  info: AccountSuspendedPayload | null;
  onClose: () => void;
}

export function AccountSuspendedDialog({ open, info, onClose }: AccountSuspendedDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="text-center text-lg font-bold text-gray-900">
            계정이 정지되었습니다
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-center text-sm text-gray-500">
            운영정책 위반으로 계정 이용이 제한되었습니다.
            {!info && ' 자세한 사항은 고객센터로 문의해 주세요.'}
          </Dialog.Description>

          {info && (
            <dl className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
              <SuspendRow label="위반 건수" value={`${info.violationCount}회`} />
              <SuspendRow label="정지 시작" value={info.suspendedAt} />
              <SuspendRow
                label="정지 종료"
                value={info.permanent ? '영구 정지' : info.suspendedUntil}
              />
            </dl>
          )}

          <div className="mt-6">
            <Button variant="primary" size="lg" fullWidth onClick={onClose}>
              확인
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SuspendRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

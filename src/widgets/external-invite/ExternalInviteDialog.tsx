'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { useExternalInvite, type InviteTab } from '@/features/external-member/useExternalInvite';

interface ExternalInviteDialogProps {
  open: boolean;
  onClose: () => void;
}

const TABS: { key: InviteTab; label: string }[] = [
  { key: 'email', label: '이메일로 추가' },
  { key: 'phone', label: '연락처로 추가' },
];

export function ExternalInviteDialog({ open, onClose }: ExternalInviteDialogProps) {
  const {
    activeTab,
    inputValue,
    isDisabled,
    isSearching,
    handleInputChange,
    handleTabChange,
    handleConfirm,
  } = useExternalInvite({ onInvited: onClose });

  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <Dialog.Title className="text-base font-bold text-gray-900">멤버 초대</Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="text-gray-900"
            >
              <IconCloseStroke width={20} height={20} />
            </button>
          </div>

          <div className="flex border-b border-gray-100 px-5 pt-3">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  'flex-1 border-b-2 pb-2.5 text-sub font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            <input
              autoFocus
              value={inputValue}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm();
              }}
              placeholder={activeTab === 'email' ? '이메일로 추가' : '연락처로 추가'}
              inputMode={activeTab === 'phone' ? 'numeric' : 'email'}
              autoComplete="off"
              className="w-full rounded-lg border border-divider bg-gray-50 px-3 py-2.5 text-sub text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
            />
          </div>

          <div className="border-t border-gray-100 p-4">
            <Button variant="primary" size="lg" fullWidth disabled={isDisabled} onClick={handleConfirm}>
              {isSearching ? '검색 중...' : '초대'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

'use client';

import { cn } from '@/shared/lib/cn';
import { useExternalInvite, type InviteTab } from '@/features/external-member/useExternalInvite';

interface InviteFormProps {
  onDone: () => void;
}

const TABS: { key: InviteTab; label: string }[] = [
  { key: 'email', label: '이메일' },
  { key: 'phone', label: '연락처' },
];

export function InviteForm({ onDone }: InviteFormProps) {
  const {
    activeTab,
    inputValue,
    isDisabled,
    isSearching,
    handleInputChange,
    handleTabChange,
    handleConfirm,
  } = useExternalInvite({ onInvited: onDone });

  return (
    <div className="border-b border-divider bg-surface px-4 py-3">
      <div className="mb-2 flex gap-1.5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'rounded-full px-3 py-1 text-sub-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-gray-100 text-text-tertiary hover:bg-gray-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleConfirm();
          }}
          placeholder={activeTab === 'email' ? '이메일로 초대' : '연락처(숫자만)로 초대'}
          inputMode={activeTab === 'phone' ? 'numeric' : 'email'}
          autoComplete="off"
          className="flex-1 rounded-lg border border-divider bg-background px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
        />
        <button
          onClick={handleConfirm}
          disabled={isDisabled}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sub font-semibold text-on-primary disabled:bg-disabled"
        >
          {isSearching ? '검색 중...' : '초대'}
        </button>
      </div>
    </div>
  );
}

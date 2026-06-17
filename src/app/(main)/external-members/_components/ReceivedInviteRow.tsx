'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { ReceivedInviteItem } from '@/features/external-member/type';

interface ReceivedInviteRowProps {
  invite: ReceivedInviteItem;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function ReceivedInviteRow({ invite, onAccept, onReject, disabled = false }: ReceivedInviteRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ProfileCircle name={invite.name} size="sm" storageKey={invite.profileUrl} />
      <div className="min-w-0 flex-1">
        <span className="text-sub font-medium text-text-primary">{invite.name}</span>
        {invite.companyName && (
          <p className="truncate text-sub-sm text-text-tertiary">{invite.companyName}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onReject}
          disabled={disabled}
          className="rounded-lg border border-divider px-2.5 py-1.5 text-sub-sm text-text-secondary hover:bg-surface-pressed disabled:opacity-50"
        >
          거절
        </button>
        <button
          onClick={onAccept}
          disabled={disabled}
          className="rounded-lg bg-primary px-2.5 py-1.5 text-sub-sm font-semibold text-on-primary hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled"
        >
          수락
        </button>
      </div>
    </div>
  );
}

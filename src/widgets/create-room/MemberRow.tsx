'use client';

import { cn } from '@/shared/lib/cn';
import type { MemberItem } from '@/shared/types/user';

interface MemberRowProps {
  member: MemberItem;
  selected: boolean;
  onToggle: () => void;
}

export function MemberRow({ member, selected, onToggle }: MemberRowProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-state-primary-highlighted' : 'hover:bg-surface-pressed',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sub font-medium text-text-secondary">
        {member.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sub font-medium text-text-primary">{member.name}</div>
        <div className="flex items-center gap-1.5 text-sub-sm text-text-tertiary">
          {member.department && <span>{member.department}</span>}
          {member.job && <span>{member.job}</span>}
        </div>
      </div>
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-primary bg-primary' : 'border-gray-300',
        )}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}

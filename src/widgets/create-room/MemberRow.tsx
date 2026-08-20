'use client';

import { cn } from '@/shared/lib/cn';
import type { MemberItem } from '@/shared/types/user';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';

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
        <div className="flex items-center gap-1 text-sub font-medium text-text-primary">
          <span className="truncate">{member.name}</span>
          {/* 협력멤버 구분 심볼 (RN 패리티) */}
          {member.isExternal && <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />}
        </div>
        <div className="flex items-center gap-1.5 text-sub-sm text-text-tertiary">
          {/* 협력멤버는 회사명, 사내멤버는 부서·직급 (RN 패리티) */}
          {member.isExternal ? (
            member.companyName && <span>{member.companyName}</span>
          ) : (
            <>
              {member.department && <span>{member.department}</span>}
              {member.job && <span>{member.job}</span>}
            </>
          )}
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

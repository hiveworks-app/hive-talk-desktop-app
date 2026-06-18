'use client';

import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { MemberItem } from '@/shared/types/user';

interface SelectMemberRowProps {
  member: MemberItem;
  selected: boolean;
  onToggle: () => void;
}

/** 새 채팅방 대화상대 선택 행 — 체크박스 + 프로필 + 이름 + 부서·직급 (Figma 931-15209) */
export function SelectMemberRow({ member, selected, onToggle }: SelectMemberRowProps) {
  const description = [member.department, member.job].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-[7px] text-left transition-colors',
        selected ? 'bg-gray-100' : 'hover:bg-gray-50',
      )}
    >
      <Checkbox checked={selected} size="lg" className="shrink-0" />
      <ProfileCircle name={member.name} size="sm" storageKey={member.profileUrl} className="h-10 w-10 shrink-0" />
      <span className="min-w-0 shrink truncate text-body text-text-primary">{member.name}</span>
      {description && (
        <span className="min-w-0 flex-1 truncate text-right text-sub-sm text-text-secondary">
          {description}
        </span>
      )}
    </button>
  );
}

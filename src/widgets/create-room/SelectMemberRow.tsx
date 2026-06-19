'use client';

import { Checkbox } from '@/shared/ui/Checkbox';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { MemberItem } from '@/shared/types/user';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';

interface SelectMemberRowProps {
  member: MemberItem;
  selected: boolean;
  onToggle: () => void;
}

/**
 * 새 채팅방 대화상대 선택 행 — 체크박스 + 프로필 + 이름(+∞) + 부서·직급/회사명·직급 (Figma 931-15209 / 1670-52577).
 * 협력멤버(isExternal)는 이름 옆 ∞ 표시 + 우측 회사명·직급, 사내멤버는 부서·직급.
 */
export function SelectMemberRow({ member, selected, onToggle }: SelectMemberRowProps) {
  const isExternal = member.isExternal === true;
  const description = isExternal
    ? [member.companyName, member.job].filter(Boolean).join(' · ')
    : [member.department, member.job].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-[7px] text-left transition-colors hover:bg-gray-50"
    >
      <Checkbox checked={selected} size="lg" className="shrink-0" />
      <ProfileCircle name={member.name} size="sm" storageKey={member.profileUrl} className="h-10 w-10 shrink-0" />
      <div className="flex min-w-0 shrink items-center gap-1">
        <span className="truncate text-body text-text-primary">{member.name}</span>
        {isExternal && <IconExternalSymbol width={18} height={18} className="shrink-0 text-gray-400" />}
      </div>
      {description && (
        <span className="min-w-0 flex-1 truncate text-right text-sub-sm text-text-secondary">
          {description}
        </span>
      )}
    </button>
  );
}

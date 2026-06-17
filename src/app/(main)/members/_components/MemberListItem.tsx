'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';

interface NormalizedMember {
  id: string;
  name: string;
  description: string;
  storageKey?: string | null;
  /** 협력멤버(외부) 여부 — true면 이름 옆에 ∞ 배지 표시 */
  isExternal: boolean;
}

interface MemberListItemProps {
  member: NormalizedMember;
  onClick: () => void;
}

export type { NormalizedMember };

export function MemberListItem({ member, onClick }: MemberListItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-[7px] text-left transition-colors hover:bg-gray-50"
    >
      {/* 아바타 40px (Figma 멤버 아이템 기준 — sm=36px 오버라이드) */}
      <ProfileCircle name={member.name} size="sm" storageKey={member.storageKey} className="h-10 w-10" />
      {/* 이름(+협력멤버 ∞ 배지): 이름은 길면 말줄임, 배지는 고정 */}
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-body text-text-primary">
          {member.name}
        </span>
        {member.isExternal && (
          <IconExternalSymbol width={18} height={10} className="shrink-0 text-text-tertiary" />
        )}
      </span>
      {/* 부서·직급: 남은 공간을 채워 우측 정렬, 길면 말줄임 (Figma 패리티) */}
      {member.description && (
        <span className="min-w-0 flex-1 truncate text-right text-sub-sm text-text-secondary">
          {member.description}
        </span>
      )}
    </button>
  );
}

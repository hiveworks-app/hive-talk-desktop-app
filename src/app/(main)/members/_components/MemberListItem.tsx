'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconStarEmpty from '@assets/icons/star-empty.svg';

interface NormalizedMember {
  id: string;
  name: string;
  description: string;
  storageKey?: string | null;
}

interface MemberListItemProps {
  member: NormalizedMember;
  onClick: () => void;
  /** 관심 멤버 고정 여부 — onTogglePin이 있을 때만 별 표시 */
  isPinned?: boolean;
  /** 별 토글 핸들러 (없으면 별 버튼 미표시 — 예: 외부 멤버) */
  onTogglePin?: () => void;
}

export type { NormalizedMember };

export function MemberListItem({ member, onClick, isPinned = false, onTogglePin }: MemberListItemProps) {
  return (
    <div className="flex w-full items-center gap-2.5 px-4 py-1.5 transition-colors hover:bg-gray-50">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <ProfileCircle name={member.name} size="sm" storageKey={member.storageKey} />
        <span className="flex-1 truncate text-sub text-text-primary">{member.name}</span>
        {member.description && (
          <span className="shrink-0 text-sub-sm text-text-secondary">{member.description}</span>
        )}
      </button>
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          aria-label={isPinned ? '관심 멤버 해제' : '관심 멤버 등록'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-gray-200"
        >
          {isPinned ? (
            <IconStarFilled width={18} height={18} />
          ) : (
            <IconStarEmpty width={18} height={18} className="opacity-50" />
          )}
        </button>
      )}
    </div>
  );
}

'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';

interface NormalizedMember {
  id: string;
  name: string;
  description: string;
  storageKey?: string | null;
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
      className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-gray-50"
    >
      <ProfileCircle name={member.name} size="sm" storageKey={member.storageKey} />
      <span className="flex-1 truncate text-sub text-text-primary">{member.name}</span>
      {member.description && (
        <span className="shrink-0 text-sub-sm text-text-secondary">{member.description}</span>
      )}
    </button>
  );
}

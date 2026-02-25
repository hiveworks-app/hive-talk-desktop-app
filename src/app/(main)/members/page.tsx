'use client';

import { useState } from 'react';
import { useGetMembers } from '@/features/members/queries';
import { cn } from '@/shared/lib/cn';
import { MemberItem } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';

export default function MembersPage() {
  const { data: members = [], isLoading } = useGetMembers();
  const [search, setSearch] = useState('');
  const myUserId = useAuthStore(s => s.user?.id);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);

  const filtered = search.trim()
    ? members.filter(
        m =>
          m.name.includes(search) ||
          m.department?.includes(search) ||
          m.email?.includes(search),
      )
    : members;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="border-b border-divider px-4 py-3">
        <h2 className="text-lg font-bold text-text-primary">멤버 목록</h2>
        <div className="mt-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서, 이메일로 검색"
            className="w-full rounded-lg border border-divider bg-gray-50 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
          />
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-text-tertiary">로딩 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-text-tertiary">멤버가 없습니다</span>
          </div>
        ) : (
          filtered.map(member => (
            <MemberRow
              key={member.userId}
              member={member}
              isMe={member.userId === myUserId}
              onSelect={() => setSelectedMember(member)}
            />
          ))
        )}
      </div>

      <UserProfileDialog
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
      />
    </main>
  );
}

function MemberRow({
  member,
  isMe,
  onSelect,
}: {
  member: MemberItem;
  isMe: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors',
        'cursor-pointer hover:bg-gray-50',
      )}
      onClick={onSelect}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-text-secondary">
        {member.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{member.name}</span>
          {isMe && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-text-tertiary">
              나
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {member.department && <span>{member.department}</span>}
          {member.job && <span>{member.job}</span>}
        </div>
      </div>
    </div>
  );
}

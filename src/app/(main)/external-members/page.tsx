'use client';

import { useState } from 'react';
import { useGetExternalMembers } from '@/features/external-member/queries';
import { InviteForm } from './_components/InviteForm';
import { ExternalMemberRow } from './_components/ExternalMemberRow';

export default function ExternalMembersPage() {
  const [search, setSearch] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const { data: members = [], isLoading } = useGetExternalMembers(search || undefined);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="border-b border-divider px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-md font-bold text-text-primary">외부 멤버</h2>
          <button
            onClick={() => setShowInviteForm(prev => !prev)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sub-sm font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)]"
          >
            {showInviteForm ? '닫기' : '초대하기'}
          </button>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 이메일로 검색"
            className="w-full rounded-lg border border-divider bg-gray-50 px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
          />
        </div>
      </header>

      {showInviteForm && (
        <InviteForm onDone={() => setShowInviteForm(false)} />
      )}

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sub text-text-tertiary">로딩 중...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sub text-text-tertiary">외부 멤버가 없습니다</span>
          </div>
        ) : (
          members.map(member => (
            <ExternalMemberRow key={member.userId} member={member} />
          ))
        )}
      </div>
    </main>
  );
}

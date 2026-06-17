'use client';

import { useState } from 'react';
import { useGetExternalMembers, useReceivedInvites, useRespondInvite } from '@/features/external-member/queries';
import { InviteForm } from './_components/InviteForm';
import { ExternalMemberRow } from './_components/ExternalMemberRow';
import { ReceivedInviteRow } from './_components/ReceivedInviteRow';

export default function ExternalMembersPage() {
  const [search, setSearch] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const { data: members = [], isLoading } = useGetExternalMembers(search || undefined);
  const { data: receivedInvites = [] } = useReceivedInvites();
  const { mutate: respondInvite, isPending: isResponding } = useRespondInvite();

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
        {receivedInvites.length > 0 && (
          <section className="border-b border-divider py-2">
            <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">
              받은 초대 ({receivedInvites.length})
            </h3>
            {receivedInvites.map(invite => (
              <ReceivedInviteRow
                key={invite.inviteId}
                invite={invite}
                disabled={isResponding}
                onAccept={() => respondInvite({ inviteId: invite.inviteId, result: 'ACCEPT' })}
                onReject={() => respondInvite({ inviteId: invite.inviteId, result: 'REJECTED' })}
              />
            ))}
          </section>
        )}
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

'use client';

import { useState } from 'react';
import {
  useGetExternalMembers,
  useReceivedInvites,
  useSentInvites,
  useRespondInvite,
} from '@/features/external-member/queries';
import { cn } from '@/shared/lib/cn';
import { ExternalInviteDialog } from '@/widgets/external-invite/ExternalInviteDialog';
import { ExternalMemberRow } from './_components/ExternalMemberRow';
import { ReceivedInviteRow } from './_components/ReceivedInviteRow';
import { SentInviteRow } from './_components/SentInviteRow';

type InviteTab = 'received' | 'sent';

export default function ExternalMembersPage() {
  const [search, setSearch] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<InviteTab>('received');
  const { data: members = [], isLoading } = useGetExternalMembers(search || undefined);
  const { data: receivedInvites = [] } = useReceivedInvites();
  const { data: sentInvites = [] } = useSentInvites();
  const { mutate: respondInvite, isPending: isResponding } = useRespondInvite();

  const hasInvites = receivedInvites.length > 0 || sentInvites.length > 0;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="border-b border-divider px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-md font-bold text-text-primary">외부 멤버</h2>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sub-sm font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)]"
          >
            초대하기
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

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {hasInvites && (
          <section className="border-b border-divider">
            <div className="flex">
              <button
                onClick={() => setInviteTab('received')}
                className={cn(
                  'flex-1 border-b-2 px-4 py-2.5 text-sub font-medium transition-colors',
                  inviteTab === 'received'
                    ? 'border-primary text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary',
                )}
              >
                받은 초대 ({receivedInvites.length})
              </button>
              <button
                onClick={() => setInviteTab('sent')}
                className={cn(
                  'flex-1 border-b-2 px-4 py-2.5 text-sub font-medium transition-colors',
                  inviteTab === 'sent'
                    ? 'border-primary text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary',
                )}
              >
                보낸 초대 ({sentInvites.length})
              </button>
            </div>

            {inviteTab === 'received' ? (
              receivedInvites.length > 0 ? (
                <div className="py-2">
                  {receivedInvites.map(invite => (
                    <ReceivedInviteRow
                      key={invite.inviteId}
                      invite={invite}
                      disabled={isResponding}
                      onAccept={() => respondInvite({ inviteId: invite.inviteId, result: 'ACCEPT' })}
                      onReject={() => respondInvite({ inviteId: invite.inviteId, result: 'REJECTED' })}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6">
                  <span className="text-sub-sm text-text-tertiary">받은 초대가 없습니다</span>
                </div>
              )
            ) : sentInvites.length > 0 ? (
              <div className="py-2">
                {sentInvites.map(invite => (
                  <SentInviteRow key={invite.inviteId} invite={invite} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <span className="text-sub-sm text-text-tertiary">보낸 초대가 없습니다</span>
              </div>
            )}
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

      <ExternalInviteDialog open={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </main>
  );
}

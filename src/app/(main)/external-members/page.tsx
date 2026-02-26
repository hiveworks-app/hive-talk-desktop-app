'use client';

import { useState } from 'react';
import {
  useGetExternalMembers,
  useInviteExternalUser,
  useCancelExternalInvite,
} from '@/features/external-member/queries';
import type { ExternalInviteStatus, ExternalMemberItem } from '@/features/external-member/type';
import { cn } from '@/shared/lib/cn';
import { useUIStore } from '@/store';

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

      {/* 초대 폼 */}
      {showInviteForm && (
        <InviteForm onDone={() => setShowInviteForm(false)} />
      )}

      {/* 멤버 목록 */}
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

function InviteForm({ onDone }: { onDone: () => void }) {
  const { showSnackbar } = useUIStore();
  const { mutateAsync: invite, isPending } = useInviteExternalUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleInvite = async () => {
    if (!email.includes('@')) {
      showSnackbar({ message: '올바른 이메일을 입력해 주세요.', state: 'error' });
      return;
    }
    await invite({ email, name: name.trim() || undefined });
    setEmail('');
    setName('');
    onDone();
  };

  return (
    <div className="border-b border-divider bg-surface px-4 py-3">
      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 주소 (필수)"
          className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-sub text-text-primary outline-none focus:border-primary"
        />
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="이름 (선택)"
          className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-sub text-text-primary outline-none focus:border-primary"
        />
        <button
          onClick={handleInvite}
          disabled={isPending || !email}
          className="w-full rounded-lg bg-primary py-2 text-sub font-semibold text-on-primary disabled:bg-disabled"
        >
          {isPending ? '초대 중...' : '초대 보내기'}
        </button>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<ExternalInviteStatus, { text: string; className: string }> = {
  PENDING: { text: '대기중', className: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { text: '수락됨', className: 'bg-green-100 text-green-700' },
  EXPIRED: { text: '만료됨', className: 'bg-gray-100 text-gray-500' },
};

function ExternalMemberRow({ member }: { member: ExternalMemberItem }) {
  const { mutateAsync: cancel, isPending } = useCancelExternalInvite();
  const status = STATUS_LABEL[member.inviteStatus];

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sub font-medium text-text-secondary">
        {member.thumbnailProfileUrl ? (
          <img
            src={member.thumbnailProfileUrl}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          member.name.charAt(0)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sub font-medium text-text-primary">{member.name}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
            {status.text}
          </span>
        </div>
        <div className="text-sub-sm text-text-tertiary">
          {member.email}
          {member.joinedRoomCount > 0 && (
            <span className="ml-2">참여 채팅방 {member.joinedRoomCount}개</span>
          )}
        </div>
      </div>
      {member.inviteStatus === 'PENDING' && (
        <button
          onClick={() => cancel(member.userId)}
          disabled={isPending}
          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-sub-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          {isPending ? '취소중' : '취소'}
        </button>
      )}
    </div>
  );
}

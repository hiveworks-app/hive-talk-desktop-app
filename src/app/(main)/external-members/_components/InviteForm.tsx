'use client';

import { useState } from 'react';
import { useInviteExternalUser } from '@/features/external-member/queries';
import { useUIStore } from '@/store';

interface InviteFormProps {
  onDone: () => void;
}

export function InviteForm({ onDone }: InviteFormProps) {
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

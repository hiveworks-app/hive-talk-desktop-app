'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useGetMembers } from '@/features/members/queries';
import { Button } from '@/shared/ui/Button';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { IconSearch } from '@/shared/ui/icons';
import { useAuthStore } from '@/store/auth/authStore';
import { MemberRow } from '@/widgets/create-room/MemberRow';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  /** 이미 방에 있는 참여자 userId (초대 대상에서 제외) */
  existingUserIds: string[];
  onInvite: (userIds: string[]) => void;
}

export function InviteMemberDialog({ open, onClose, existingUserIds, onInvite }: InviteMemberDialogProps) {
  const { data: members = [], isLoading } = useGetMembers();
  const myUserId = useAuthStore(s => s.user?.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existing = useMemo(() => new Set(existingUserIds.map(String)), [existingUserIds]);
  const candidates = useMemo(
    () => members.filter(m => String(m.userId) !== String(myUserId) && !existing.has(String(m.userId))),
    [members, myUserId, existing],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      m =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reset = () => {
    setSearch('');
    setSelected(new Set());
  };
  const close = () => {
    reset();
    onClose();
  };
  const handleInvite = () => {
    if (selected.size === 0) return;
    onInvite([...selected]);
    reset();
  };

  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[560px] max-h-[80vh] w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <Dialog.Title className="text-base font-bold text-gray-900">대화상대 초대</Dialog.Title>
            <button type="button" onClick={close} aria-label="닫기" className="text-gray-900">
              <IconCloseStroke width={20} height={20} />
            </button>
          </div>

          <div className="px-5 pt-3">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-2">
              <IconSearch size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름·부서 검색"
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {candidates.length === 0 ? '초대할 멤버가 없습니다' : '검색 결과가 없습니다'}
              </div>
            ) : (
              filtered.map(member => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  selected={selected.has(String(member.userId))}
                  onToggle={() => toggle(String(member.userId))}
                />
              ))
            )}
          </div>

          <div className="border-t border-gray-100 p-4">
            <Button variant="primary" size="lg" fullWidth disabled={selected.size === 0} onClick={handleInvite}>
              {selected.size > 0 ? `${selected.size}명 초대` : '초대'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

'use client';

import { comparePolicyMemberName } from '@/features/members/policySort';
import { useMemo, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import * as Dialog from '@radix-ui/react-dialog';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';
import { useGetMembers } from '@/features/members/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import { useAuthStore } from '@/store/auth/authStore';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { MemberRow } from '@/widgets/create-room/MemberRow';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  /** 이미 방에 있는 참여자 userId (초대 대상에서 제외) */
  existingUserIds: string[];
  onInvite: (userIds: string[]) => void;
  /**
   * 사내채팅(DM/GM) 방 여부 — true면 협력멤버(isExternal)를 초대 후보에서 제외.
   * RN 패리티: 사내 방 초대는 사내멤버만, 협력멤버는 EM에서만 초대 가능 (정책 external-member.md).
   */
  companyOnly?: boolean;
}

export function InviteMemberDialog({ open, onClose, existingUserIds, onInvite, companyOnly }: InviteMemberDialogProps) {
  // 어두운 스크림 → 창 버튼(WCO) 딤 동기화 (2026-09-02 전수 점검 누락분)
  useDimmed(open);
  // ESC=다이얼로그 닫기만 — 억제 없으면 Radix가 닫는 순간 메인이 창을 트레이로 숨긴다 (2026-09-03)
  useEscSuppress(open);
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  // EM 방 초대: 협력/사내 2탭 (RN CreateExternalRoomStep1 패리티) — 사내 방은 탭 없음
  const [activeTab, setActiveTab] = useState<'external' | 'company'>('external');
  const myUserId = useAuthStore(s => s.user?.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const blockedItems = useBlockedMembersStore(s => s.items);
  const blockedIdSet = useMemo(
    () => new Set(blockedItems.map(m => String(m.userId))),
    [blockedItems],
  );

  const existing = useMemo(() => new Set(existingUserIds.map(String)), [existingUserIds]);
  // 차단 멤버는 초대 후보에서 제외 (정책 block.md); 사내 방(DM/GM)은 협력멤버도 제외 (RN 패리티)
  const candidates = useMemo(
    () =>
      members.filter(
        m =>
          String(m.userId) !== String(myUserId) &&
          !existing.has(String(m.userId)) &&
          !blockedIdSet.has(String(m.userId)) &&
          (!companyOnly || !m.isExternal),
      )
        .sort((a, b) => comparePolicyMemberName(a.name, b.name)),
    [members, myUserId, existing, blockedIdSet, companyOnly],
  );
  // EM 방: 현재 탭 소스 (협력/사내), 사내 방: 전체 후보
  const tabCandidates = useMemo(() => {
    if (companyOnly) return candidates;
    return candidates.filter(m => (activeTab === 'external' ? m.isExternal === true : m.isExternal !== true));
  }, [candidates, companyOnly, activeTab]);

  // 관심멤버 섹션 — 현재 탭 후보 중 관심멤버 (사용자 지정 순서 유지, RN 패리티)
  const pinnedSection = useMemo(() => {
    if (companyOnly) return [];
    const candidateIds = new Set(tabCandidates.map(m => String(m.userId)));
    return pinnedMembers.filter(m => candidateIds.has(String(m.userId)));
  }, [companyOnly, pinnedMembers, tabCandidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabCandidates;
    return tabCandidates.filter(
      m =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    );
  }, [tabCandidates, search]);

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
        <Dialog.Overlay className="motion-dim fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="motion-center-pop fixed left-1/2 top-1/2 z-50 flex h-[560px] max-h-[80vh] w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <Dialog.Title className="text-heading-md font-bold text-gray-900">대화상대 초대</Dialog.Title>
            <button type="button" onClick={close} aria-label="닫기" className="text-gray-900">
              <IconCloseStroke width={20} height={20} />
            </button>
          </div>

          {/* EM 방: 협력멤버/사내멤버 탭 (RN 패리티) */}
          {!companyOnly && (
            <div className="flex border-b border-gray-100 px-5 pt-3">
              {([
                { key: 'external', label: '협력멤버' },
                { key: 'company', label: '사내멤버' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 border-b-2 pb-2.5 text-sub font-medium transition-colors',
                    activeTab === tab.key
                      ? 'border-primary text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-secondary',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-5 pt-3">
            {/* 다이얼로그 내 멤버 검색바 — 방 만들기(CreateRoomDialog)와 동일 규격 (2026-09-03 전수 통일:
                기존 py-2(≈36px)+text-sm(비토큰)+14px 아이콘이 검색바 표준(40px·text-sub·20px)에서 이탈) */}
            <div className="flex items-center gap-2.5 rounded-lg border border-divider bg-gray-100 px-3.5 py-2.5">
              <IconSearchDefault width={20} height={20} className="shrink-0 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름·부서 검색"
                className="min-w-0 flex-1 bg-transparent text-sub text-text-primary outline-none placeholder:text-text-tertiary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <div className="flex justify-center py-8 text-gray-400"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {candidates.length === 0 ? '초대할 멤버가 없어요.' : '검색 결과가 없어요.'}
              </div>
            ) : (
              <>
                {/* 관심멤버 섹션 (EM 방, 검색 중엔 미표시 — RN 패리티) */}
                {!search.trim() && pinnedSection.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-sub-sm font-semibold text-text-tertiary">관심멤버</p>
                    {pinnedSection.map(member => (
                      <MemberRow
                        key={`pinned-${member.userId}`}
                        member={member}
                        selected={selected.has(String(member.userId))}
                        onToggle={() => toggle(String(member.userId))}
                      />
                    ))}
                    <p className="px-3 pb-1 pt-3 text-sub-sm font-semibold text-text-tertiary">전체</p>
                  </>
                )}
                {filtered.map(member => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    selected={selected.has(String(member.userId))}
                    onToggle={() => toggle(String(member.userId))}
                  />
                ))}
              </>
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

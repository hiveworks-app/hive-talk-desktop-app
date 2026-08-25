'use client';

import { comparePolicyMemberName } from '@/features/members/policySort';
import { useMemo, useState } from 'react';
import { BLOCK_MESSAGES } from '@/features/block/blockedMessage';
import { isBlockableMember } from '@/features/block/isBlockable';
import { useBlockMember, useGetBlockedMembers, useUnblockMember } from '@/features/block/queries';
import { useGetMembers } from '@/features/members/queries';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import type { MemberItem } from '@/shared/types/user';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import IconArrowBack from '@assets/icons/arrow_back.svg';
import IconBlock from '@assets/icons/block.svg';
import IconCrown from '@assets/icons/crown.svg';
import { SettingsOverlay } from '../_components/SettingsOverlay';

/**
 * 차단멤버 관리 (RN BlockListScreen 패리티).
 * 차단 섹션(차단 최신순, 해제는 컨펌 없이 즉시) + 멤버 섹션(차단하기, 컨펌 후 optimistic).
 * 내 회사 ADMIN은 차단 불가(U020) — 왕관 + '관리자' 배지로 대체.
 */
export default function BlockedMembersPage() {
  const router = useAppRouter();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const myUserId = useAuthStore(s => s.user?.id);
  const viewerCompanyId = useAuthStore(s => s.user?.companyId);

  const [search, setSearch] = useState('');
  const [blockTarget, setBlockTarget] = useState<MemberItem | null>(null);

  const { data: blockedMembers = [] } = useGetBlockedMembers();
  const { data: members = [] } = useGetMembers();
  const { mutate: blockMember } = useBlockMember();
  const { mutate: unblockMember } = useUnblockMember();

  const blockedIdSet = useMemo(
    () => new Set(blockedMembers.map(m => String(m.userId))),
    [blockedMembers],
  );

  // 차단 섹션 — 서버 응답 순서(차단 최신순) 유지, 검색 필터만 (RN useBlockListController 패리티)
  const blockedDisplay = useMemo(
    () => filterByhangeulSearch(blockedMembers, search, m => m.name),
    [blockedMembers, search],
  );
  // 멤버 섹션 — 전체 멤버 − 차단 − 본인, 정책 정렬
  const memberDisplay = useMemo(
    () =>
      [...filterByhangeulSearch(
        members.filter(
          m => !blockedIdSet.has(String(m.userId)) && String(m.userId) !== String(myUserId),
        ),
        search,
        m => m.name,
      )].sort((a, b) => comparePolicyMemberName(a.name, b.name)),
    [members, blockedIdSet, myUserId, search],
  );

  const isSearching = search.trim().length > 0;
  const isEmpty = blockedDisplay.length === 0 && memberDisplay.length === 0;

  const handleBlockConfirm = () => {
    if (!blockTarget) return;
    blockMember(blockTarget, {
      onSuccess: () => showSnackbar({ message: BLOCK_MESSAGES.blocked }),
    });
    setBlockTarget(null);
  };

  // 해제는 컨펌 없이 즉시 (RN useUnblockMemberWithHud 패리티)
  const handleUnblock = (userId: string) => {
    unblockMember(userId, {
      onSuccess: () => showSnackbar({ message: BLOCK_MESSAGES.unblocked, state: 'success' }),
    });
  };

  return (
    <SettingsOverlay bg="bg-background">
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        <h2 className="text-heading-md font-medium text-text-primary">차단멤버 관리</h2>
        {/* RN BlockListScreen 패리티 — 좌측 ← 뒤로가기(진입 경로로 복귀), 호버 배경 박스 없음 */}
        <button
          onClick={() => router.back()}
          className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="뒤로가기"
        >
          <IconArrowBack width={24} height={24} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-[480px] flex-col gap-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="멤버 검색"
            className="h-10 rounded-xl bg-surface px-4 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/40"
          />

          {isEmpty ? (
            <EmptyState
              message={isSearching ? '찾으시는 멤버가 없어요.' : '멤버가 없어요.'}
              variant={isSearching ? 'search' : 'sad'}
              className="h-auto py-16"
            />
          ) : (
            <>
              {blockedDisplay.length > 0 && (
                <section>
                  <h3 className="mb-1 px-1 text-sub-sm font-medium text-text-secondary">
                    차단 멤버 ({blockedDisplay.length})
                  </h3>
                  {blockedDisplay.map(m => (
                    <BlockedRow key={m.userId} member={m} onUnblock={handleUnblock} />
                  ))}
                </section>
              )}
              {memberDisplay.length > 0 && (
                <section>
                  <h3 className="mb-1 px-1 text-sub-sm font-medium text-text-secondary">
                    멤버 ({memberDisplay.length})
                  </h3>
                  {memberDisplay.map(m => (
                    <BlockableRow
                      key={m.userId}
                      member={m}
                      blockable={isBlockableMember(m, viewerCompanyId)}
                      onBlock={() => setBlockTarget(m)}
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={blockTarget !== null}
        title={`${blockTarget?.name ?? ''}님을 차단할까요?`}
        description={BLOCK_MESSAGES.blockConfirmDescription}
        confirmLabel="차단"
        cancelLabel="취소"
        neutral
        onConfirm={handleBlockConfirm}
        onCancel={() => setBlockTarget(null)}
      />
    </SettingsOverlay>
  );
}

/** 차단된 멤버 행 — 프로필 흰색 70% 오버레이 + 회색 이름 + 차단 아이콘 + [해제] (RN BlockedMemberRow) */
function BlockedRow({
  member,
  onUnblock,
}: {
  member: MemberItem;
  onUnblock: (userId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <div className="relative shrink-0">
        <ProfileCircle
          name={member.name}
          size="sm"
          storageKey={member.thumbnailProfileUrl || member.profileUrl}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full bg-white/70" />
      </div>
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-sub text-gray-500">
        <IconBlock width={16} height={16} className="shrink-0 text-gray-500" />
        <span className="truncate">{member.name}</span>
      </span>
      <button
        type="button"
        onClick={() => onUnblock(String(member.userId))}
        className="shrink-0 rounded-lg border border-outline px-3 py-1.5 text-sub-sm text-text-primary transition-colors hover:bg-surface-pressed"
      >
        해제
      </button>
    </div>
  );
}

/** 차단 가능 멤버 행 — [차단하기] 버튼, 내 회사 ADMIN은 왕관+관리자 배지 (RN BlockableMemberRow) */
function BlockableRow({
  member,
  blockable,
  onBlock,
}: {
  member: MemberItem;
  blockable: boolean;
  onBlock: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <ProfileCircle
        name={member.name}
        size="sm"
        storageKey={member.thumbnailProfileUrl || member.profileUrl}
      />
      <span className="min-w-0 flex-1 truncate text-sub text-text-primary">{member.name}</span>
      {blockable ? (
        <button
          type="button"
          onClick={onBlock}
          className="shrink-0 rounded-lg border border-outline px-3 py-1.5 text-sub-sm text-text-primary transition-colors hover:bg-surface-pressed"
        >
          차단하기
        </button>
      ) : (
        <span className="flex w-[76px] shrink-0 items-center justify-center gap-1 text-sub-sm text-gray-600">
          <IconCrown width={16} height={16} className="text-gray-400" />
          관리자
        </span>
      )}
    </div>
  );
}

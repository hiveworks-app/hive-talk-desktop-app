'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetMembers } from '@/features/members/queries';
import { useGetExternalMembers } from '@/features/external-member/queries';
import type { ExternalMemberItem } from '@/features/external-member/type';
import { cn } from '@/shared/lib/cn';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconAddMemberDefault from '@assets/icons/add-member-default.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { useAuthStore } from '@/store/auth/authStore';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import { MyProfileHeader } from './_components/MyProfileHeader';
import { MemberListItem } from './_components/MemberListItem';
import type { NormalizedMember } from './_components/MemberListItem';
import { Chip } from './_components/Chip';

type MemberChipType = 'all' | 'company' | 'external';

function normalizeCompanyMember(item: MemberItem): NormalizedMember {
  return {
    id: `company-${item.userId}`,
    name: item.name,
    description: [item.department, item.job].filter(Boolean).join(' · '),
    storageKey: item.profileUrl,
  };
}

function normalizeExternalMember(item: ExternalMemberItem): NormalizedMember {
  const statusText =
    item.inviteStatus === 'PENDING'
      ? '초대 대기'
      : item.inviteStatus === 'EXPIRED'
        ? '초대 만료'
        : '';

  return {
    id: `external-${item.userId}`,
    name: item.name,
    description: statusText,
    storageKey: item.thumbnailProfileUrl,
  };
}

export default function MembersPage() {
  const user = useAuthStore(s => s.user);
  const isOrgMember = user?.userType === USER_TYPE.ORG_MEMBER;

  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [activeChip, setActiveChip] = useState<MemberChipType>(isOrgMember ? 'all' : 'external');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

  useEffect(() => {
    if (isSearchVisible) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isSearchVisible]);

  const { data: members = [], isLoading: membersLoading } = useGetMembers();
  const { data: externalMembers = [], isLoading: externalLoading } = useGetExternalMembers();

  const filteredCompany = useMemo(
    () => filterByhangeulSearch(members, search, item => item.name),
    [members, search],
  );
  const filteredExternal = useMemo(
    () => filterByhangeulSearch(externalMembers, search, item => item.name),
    [externalMembers, search],
  );

  const displayMembers = useMemo(() => {
    const companyNormalized = filteredCompany.map(normalizeCompanyMember);
    const externalNormalized = filteredExternal.map(normalizeExternalMember);

    if (activeChip === 'all') return [...companyNormalized, ...externalNormalized];
    if (activeChip === 'company') return companyNormalized;
    return externalNormalized;
  }, [filteredCompany, filteredExternal, activeChip]);

  const handleMemberPress = useCallback(
    (id: string) => {
      const userId = id.replace(/^(company|external)-/, '');
      const member = members.find(m => m.userId === userId);
      if (member) setSelectedMember(member);
    },
    [members],
  );

  const isLoading = activeChip === 'external' ? externalLoading : membersLoading;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-gray-100">
      {/* TopBar */}
      <header className="electron-drag">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-heading-lg font-semibold text-text-primary">멤버목록</h2>
          <div className="electron-no-drag flex items-center gap-1">
            <button
              onClick={() => setIsSearchVisible(prev => !prev)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
            >
              <IconSearchDefault width={20} height={20} />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
            >
              <IconAddMemberDefault width={20} height={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 검색 바 */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isSearchVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-b border-divider bg-background px-4 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setSearch('');
                    setIsSearchVisible(false);
                  }
                }}
                placeholder="찾으시는 분의 성함을 입력하세요."
                className="flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
              />
              <button
                onClick={() => {
                  setSearch('');
                  setIsSearchVisible(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 내 프로필 헤더 */}
      <MyProfileHeader onOpenProfile={() => setIsMyProfileOpen(true)} />

      {/* 칩 + 리스트 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {isOrgMember && (
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <Chip label="전체" active={activeChip === 'all'} onClick={() => setActiveChip('all')} />
            <Chip label="사내멤버" active={activeChip === 'company'} onClick={() => setActiveChip('company')} />
            <Chip label="협력멤버" active={activeChip === 'external'} onClick={() => setActiveChip('external')} />
          </div>
        )}

        {/* 멤버 리스트 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sub text-text-tertiary">로딩 중...</span>
            </div>
          ) : displayMembers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sub text-text-tertiary">멤버가 없습니다</span>
            </div>
          ) : (
            <>
              {/* 관심 멤버 섹션 */}
              <div className="border-b border-divider pb-3.5">
                <div className="flex items-end gap-1 px-4">
                  <IconStarFilled width={20} height={20} />
                  <span className="text-sub-sm text-text-secondary">관심 멤버 (3)</span>
                </div>
                <div className="mt-1 flex flex-col">
                  <MemberListItem
                    member={{ id: 'favorite-1', name: '홍길동1', description: '생산2팀 · 대리' }}
                    onClick={() => handleMemberPress('favorite-1')}
                  />
                  <MemberListItem
                    member={{ id: 'favorite-2', name: '홍길동2', description: '생산2팀 · 대리' }}
                    onClick={() => handleMemberPress('favorite-2')}
                  />
                  <MemberListItem
                    member={{ id: 'favorite-3', name: '홍길동3', description: '생산2팀 · 대리' }}
                    onClick={() => handleMemberPress('favorite-3')}
                  />
                </div>
              </div>

              {/* 전체멤버 헤더 */}
              <div className="flex items-center gap-1 px-4 py-3">
                <span className="text-sub-sm text-text-secondary">전체멤버</span>
                <span className="text-sub-sm text-text-secondary">({displayMembers.length})</span>
              </div>

              {/* 멤버 아이템 리스트 */}
              <div className="flex flex-col">
                {displayMembers.map(item => (
                  <MemberListItem
                    key={item.id}
                    member={item}
                    onClick={() => handleMemberPress(item.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 다이얼로그 */}
      <UserProfileDialog
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
      />
      <MyProfileDialog
        isOpen={isMyProfileOpen}
        onClose={() => setIsMyProfileOpen(false)}
      />
    </main>
  );
}

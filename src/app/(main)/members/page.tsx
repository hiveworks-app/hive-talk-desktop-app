'use client';

import { useCallback, useMemo, useState } from 'react';
import { useGetMembers } from '@/features/members/queries';
import { useGetExternalMembers } from '@/features/external-member/queries';
import type { ExternalMemberItem } from '@/features/external-member/type';
import { useMyProfileHook } from '@/features/profile/useMyProfileHook';
import { cn } from '@/shared/lib/cn';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconAddMemberDefault from '@assets/icons/add-member-default.svg';
import IconSettingsFilled from '@assets/icons/settings-filled.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconArrowRightDefault from '@assets/icons/arrow-right-default.svg';
import { useAuthStore } from '@/store/auth/authStore';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';

type MemberChipType = 'all' | 'company' | 'external';

interface NormalizedMember {
  id: string;
  name: string;
  description: string;
  storageKey?: string | null;
}

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

  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

  // 데이터 조회
  const { data: members = [], isLoading: membersLoading } = useGetMembers();
  const { data: externalMembers = [], isLoading: externalLoading } = useGetExternalMembers();

  // 한글 검색 필터링 (초성, 자모 검색 지원)
  const filteredCompany = useMemo(
    () => filterByhangeulSearch(members, search, item => item.name),
    [members, search],
  );
  const filteredExternal = useMemo(
    () => filterByhangeulSearch(externalMembers, search, item => item.name),
    [externalMembers, search],
  );

  // 정규화 + 칩 필터링
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

  // 현재 활성 탭에 해당하는 데이터만 로딩 상태로 판단
  // → external members API 실패가 전체 페이지를 블로킹하지 않도록 분리
  const isLoading = activeChip === 'external' ? externalLoading : membersLoading;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-gray-100">
      {/* 검색 오버레이 */}
      {isSearchVisible && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-divider bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSearch('');
                  setIsSearchVisible(false);
                }
              }}
              placeholder="찾으시는 분의 성함을 입력하세요."
              className="flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
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
      )}

      {/* TopBar: 타이틀 + 우측 버튼들 (RN: border 없이 bg-gray-100 위에 배치) */}
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

      {/* 내 프로필 헤더 (MembersProfileHeader) */}
      <MyProfileHeader onOpenProfile={() => setIsMyProfileOpen(true)} />

      {/* 칩 + 리스트 영역 (RN: rounded-t-[16px] 카드) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {/* 소속 유저만 칩 표시 */}
        {isOrgMember && (
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <Chip
              label="전체"
              active={activeChip === 'all'}
              onClick={() => setActiveChip('all')}
            />
            <Chip
              label="사내멤버"
              active={activeChip === 'company'}
              onClick={() => setActiveChip('company')}
            />
            <Chip
              label="협력멤버"
              active={activeChip === 'external'}
              onClick={() => setActiveChip('external')}
            />
          </div>
        )}

        {/* 멤버 리스트 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-text-tertiary">로딩 중...</span>
            </div>
          ) : displayMembers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-text-tertiary">멤버가 없습니다</span>
            </div>
          ) : (
            <>
              {/* 관심 멤버 섹션 (하드코딩 더미 데이터 - RN과 동일) */}
              <div className="border-b border-divider pb-3.5">
                <div className="flex items-end gap-1 px-4">
                  <IconStarFilled width={20} height={20} />
                  <span className="text-xs text-text-secondary">관심 멤버 (3)</span>
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
                <span className="text-xs text-text-secondary">전체멤버</span>
                <span className="text-xs text-text-secondary">({displayMembers.length})</span>
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

/** 내 프로필 헤더 (RN MembersProfileHeader와 동일 구조) */
function MyProfileHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { name, department, job, profileUrl } = useMyProfileHook();

  return (
    <div className="flex items-center px-4 pb-2 pt-3">
      {/* 좌측: 프로필 이미지 + 텍스트 */}
      <button
        onClick={onOpenProfile}
        className="flex flex-1 items-center gap-3.5 text-left"
      >
        <ProfileCircle name={name ?? '?'} size="lg" storageKey={profileUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold text-text-primary">
            {name}
          </div>
          {(department || job) && (
            <div className="flex items-center gap-1 text-xs text-text-primary">
              <span>{[department, job].filter(Boolean).join(' · ')}</span>
              <IconArrowRightDefault width={14} height={14} className="text-gray-900" />
            </div>
          )}
        </div>
      </button>

      {/* 우측: 설정 아이콘 */}
      <button
        onClick={onOpenProfile}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gray-300 p-1.5 text-gray-500 transition-colors hover:bg-gray-400"
      >
        <IconSettingsFilled width={24} height={24} />
      </button>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-gray-100 text-text-secondary hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}

function MemberListItem({
  member,
  onClick,
}: {
  member: NormalizedMember;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-gray-50"
    >
      <ProfileCircle name={member.name} size="sm" storageKey={member.storageKey} />
      <span className="flex-1 truncate text-sub text-text-primary">{member.name}</span>
      {member.description && (
        <span className="shrink-0 text-xs text-text-secondary">{member.description}</span>
      )}
    </button>
  );
}

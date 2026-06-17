'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetMembers } from '@/features/members/queries';
import {
  useGetPinnedMembers,
  useReorderPinnedMembers,
} from '@/features/pinned-members/queries';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import type { NormalizedMember } from './_components/MemberListItem';

type MemberChipType = 'all' | 'company' | 'external';

/**
 * MemberItem(/app/users) → 멤버 행 표시용 정규화.
 * 협력멤버(isExternal)는 부서·직급 대신 회사명을 노출하고 id에 external- prefix를 부여한다.
 * (RN 앱 src/features/members/lib.ts와 동일 규칙 — 협력/사내 단일 소스 패리티)
 */
function normalizeMember(item: MemberItem): NormalizedMember {
  const isExternal = item.isExternal === true;
  return {
    id: `${isExternal ? 'external' : 'company'}-${item.userId}`,
    name: item.name,
    description: isExternal
      ? item.companyName ?? ''
      : [item.department, item.job].filter(Boolean).join(' · '),
    storageKey: item.profileUrl,
    isExternal,
  };
}

/** 활성 칩에 따라 멤버를 사내/협력으로 필터 (all=구분 없음) */
function scopeByChip(items: MemberItem[], chip: MemberChipType): MemberItem[] {
  if (chip === 'company') return items.filter(m => m.isExternal !== true);
  if (chip === 'external') return items.filter(m => m.isExternal === true);
  return items;
}

export function useMembersPage() {
  const user = useAuthStore(s => s.user);
  const isOrgMember = user?.userType === USER_TYPE.ORG_MEMBER;

  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [activeChip, setActiveChip] = useState<MemberChipType>(isOrgMember ? 'all' : 'external');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  // 멤버 초대 모달(이메일/연락처 검색 초대) 노출 여부 — 초대하기(사람+) 버튼이 연다.
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  useEffect(() => {
    if (isSearchVisible) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchVisible]);

  // 멤버목록 단일 소스: /app/users 가 사내·협력 멤버를 isExternal 로 함께 응답한다.
  // (/app/externals 는 초대 관리 전용이라 멤버목록 소스로 쓰지 않는다)
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const { reorder: reorderPinned } = useReorderPinnedMembers();

  // 외부유저는 칩이 없으므로 항상 'all'(서버가 협력멤버만 응답) — RN과 동일
  const effectiveChip: MemberChipType = isOrgMember ? activeChip : 'all';

  const filteredMembers = useMemo(
    () => filterByhangeulSearch(members, search, item => item.name),
    [members, search],
  );
  const filteredPinned = useMemo(
    () => filterByhangeulSearch(pinnedMembers, search, item => item.name),
    [pinnedMembers, search],
  );

  const displayMembers = useMemo(
    () => scopeByChip(filteredMembers, effectiveChip).map(normalizeMember),
    [filteredMembers, effectiveChip],
  );
  // 관심멤버도 칩별로 분기 (협력 칩 → 협력 pinned만) — 정책: 관심멤버 수는 탭별 표시
  const pinnedDisplay = useMemo(
    () => scopeByChip(filteredPinned, effectiveChip).map(normalizeMember),
    [filteredPinned, effectiveChip],
  );

  const hasContent = pinnedDisplay.length > 0 || displayMembers.length > 0;

  // 검색어가 입력된 상태인지 (공백만 입력한 경우는 검색으로 보지 않음)
  const isSearching = search.trim().length > 0;

  // 활성 칩별 섹션 헤더 라벨 (협력 칩 → '협력멤버', 사내 칩 → '사내멤버')
  const memberSectionLabel =
    activeChip === 'company' ? '사내멤버' : activeChip === 'external' ? '협력멤버' : '전체멤버';

  // 검색 중 헤더에 표시할 "검색결과 (N)"의 N — 본문 멤버 리스트 개수.
  // 관심멤버 섹션은 자체적으로 '관심멤버 (N)' 카운트를 따로 가지므로,
  // 본문 헤더 숫자는 화면 본문 행 수와 1:1로 맞춘다. (모바일 패리티: 검색결과 카운트)
  const searchResultCount = displayMembers.length;

  const handleReorderPinned = useCallback(
    (orderedIds: string[]) => {
      reorderPinned(orderedIds.map(id => id.replace(/^(company|external)-/, '')));
    },
    [reorderPinned],
  );

  const handleMemberPress = useCallback(
    (id: string) => {
      const userId = id.replace(/^(company|external)-/, '');
      const member = members.find(m => String(m.userId) === userId);
      if (member) setSelectedMember(member);
    },
    [members],
  );

  const toggleSearch = useCallback(() => setIsSearchVisible(prev => !prev), []);
  const clearSearch = useCallback(() => { setSearch(''); setIsSearchVisible(false); }, []);

  return {
    isOrgMember, search, setSearch, isSearchVisible, toggleSearch, clearSearch,
    activeChip, setActiveChip, searchInputRef, selectedMember, setSelectedMember,
    isMyProfileOpen, setIsMyProfileOpen, displayMembers, handleMemberPress, isLoading,
    pinnedDisplay, handleReorderPinned, hasContent, memberSectionLabel,
    isSearching, searchResultCount, isInviteOpen, setIsInviteOpen,
  };
}

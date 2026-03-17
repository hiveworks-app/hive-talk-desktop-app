'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetMembers } from '@/features/members/queries';
import { useGetExternalMembers } from '@/features/external-member/queries';
import type { ExternalMemberItem } from '@/features/external-member/type';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import type { NormalizedMember } from './_components/MemberListItem';

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
  const statusText = item.inviteStatus === 'PENDING' ? '초대 대기' : item.inviteStatus === 'EXPIRED' ? '초대 만료' : '';
  return { id: `external-${item.userId}`, name: item.name, description: statusText, storageKey: item.thumbnailProfileUrl };
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

  useEffect(() => {
    if (isSearchVisible) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchVisible]);

  const { data: members = [], isLoading: membersLoading } = useGetMembers();
  const { data: externalMembers = [], isLoading: externalLoading } = useGetExternalMembers();

  const filteredCompany = useMemo(() => filterByhangeulSearch(members, search, item => item.name), [members, search]);
  const filteredExternal = useMemo(() => filterByhangeulSearch(externalMembers, search, item => item.name), [externalMembers, search]);

  const displayMembers = useMemo(() => {
    const company = filteredCompany.map(normalizeCompanyMember);
    const external = filteredExternal.map(normalizeExternalMember);
    if (activeChip === 'all') return [...company, ...external];
    return activeChip === 'company' ? company : external;
  }, [filteredCompany, filteredExternal, activeChip]);

  const handleMemberPress = useCallback((id: string) => {
    const userId = id.replace(/^(company|external)-/, '');
    const member = members.find(m => m.userId === userId);
    if (member) setSelectedMember(member);
  }, [members]);

  const isLoading = activeChip === 'external' ? externalLoading : membersLoading;
  const toggleSearch = useCallback(() => setIsSearchVisible(prev => !prev), []);
  const clearSearch = useCallback(() => { setSearch(''); setIsSearchVisible(false); }, []);

  return {
    isOrgMember, search, setSearch, isSearchVisible, toggleSearch, clearSearch,
    activeChip, setActiveChip, searchInputRef, selectedMember, setSelectedMember,
    isMyProfileOpen, setIsMyProfileOpen, displayMembers, handleMemberPress, isLoading,
  };
}

'use client';

import { comparePolicyMemberName } from '@/features/members/policySort';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useGetMembers } from '@/features/members/queries';
import { getMemberNewSince, selectNewMembers } from '@/features/members/newMember';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { NEW_MEMBER_WINDOW_MS } from '@/shared/config/constants';
import { hasOpenOverlay } from '@/shared/utils/overlayStack';
import { useReceivedInvites } from '@/features/external-member/queries';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import type { NormalizedMember } from './_components/MemberListItem';

export type MemberChipType = 'all' | 'company' | 'external';

/**
 * MemberItem(/app/users) → 멤버 행 표시용 정규화.
 * 협력멤버(isExternal)는 부서·직급 대신 회사명을 노출하고 id에 external- prefix를 부여한다.
 * (RN 앱 src/features/members/lib.ts와 동일 규칙 — 협력/사내 단일 소스 패리티)
 */
export function normalizeMember(item: MemberItem): NormalizedMember {
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
export function scopeByChip(items: MemberItem[], chip: MemberChipType): MemberItem[] {
  if (chip === 'company') return items.filter(m => m.isExternal !== true);
  if (chip === 'external') return items.filter(m => m.isExternal === true);
  return items;
}

// 마지막 선택 칩 (세션 보존 — 영속 아님, RN 패리티)
let lastActiveChip: MemberChipType | null = null;

export function useMembersPage() {
  const user = useAuthStore(s => s.user);
  const isOrgMember = user?.userType === USER_TYPE.ORG_MEMBER;

  // 멤버 검색은 별도 풀스크린 화면(MemberSearchOverlay) — RN /member-search 방식 (2026-08-20 사용자 확정)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // 칩 상태는 모듈 스코프에 보존 — 페이지 이탈/재진입에도 유지 (RN companyChatChipStore 패턴)
  const [activeChip, setActiveChipState] = useState<MemberChipType>(
    () => lastActiveChip ?? (isOrgMember ? 'all' : 'external'),
  );
  const setActiveChip = useCallback((chip: MemberChipType) => {
    lastActiveChip = chip;
    setActiveChipState(chip);
  }, []);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  // 멤버 초대 모달(이메일/연락처 검색 초대) 노출 여부 — 초대하기(사람+) 버튼이 연다.
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  // 초대현황 모달(받은/보낸 초대) 노출 여부 — 편지봉투 버튼이 연다.
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // 편지봉투 빨간 dot 배지용 — 받은(대기 중) 초대 개수 (RN externalReceivedCount 패리티)
  const { data: receivedInvites = [] } = useReceivedInvites();
  const receivedInviteCount = receivedInvites.length;

  // ⌘F/Ctrl+F = 멤버 검색 열기 (데스크톱 관례). 프로필·초대 등 오버레이가 열려 있으면 무시
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (hasOpenOverlay()) return;
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 초대장 도착 모달 '확인하기' → 초대현황 자동 오픈 (1회 소비, RN 패리티).
  // 마운트 1회 소비가 아니라 요청 플래그에 반응해야 한다 — 이미 멤버목록에 떠 있는 상태에서
  // 확인하기를 누르면 같은 경로 push라 리마운트가 없어 열리지 않던 결함 (2026-08-27 QA)
  // 소비(consume)는 반드시 타이머 콜백 안에서 — effect 본문에서 소비하면 플래그 변화가
  // 동일 effect를 재실행시켜 cleanup이 타이머를 죽인다 (StrictMode 이중 마운트에도 동일 원리)
  const inviteStatusRequested = useMemberInviteStore(s => s.openInviteStatusRequested);
  useEffect(() => {
    if (!inviteStatusRequested) return;
    const timer = setTimeout(() => {
      if (useMemberInviteStore.getState().consumeOpenInviteStatus()) setIsStatusOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [inviteStatusRequested]);

  // 멤버목록 단일 소스: /app/users 가 사내·협력 멤버를 isExternal 로 함께 응답한다.
  // (/app/externals 는 초대 관리 전용이라 멤버목록 소스로 쓰지 않는다)
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  // 차단 멤버는 멤버목록·관심멤버 양쪽에서 숨김 (정책 block.md — 차단멤버 관리에서만 노출)
  // cold start write-through(스토어 영속) 겸용 — 상시 마운트 지점
  const { data: blockedMembers = [] } = useGetBlockedMembers();

  // 외부유저(게스트)는 협력 칩 고정 — 관심멤버까지 isExternal 필터가 걸린다.
  // 'all'이면 서버가 사내 레코드를 섞어줄 때 관심멤버 섹션에 노출된다 (RN activeChip='external' 패리티)
  const effectiveChip: MemberChipType = isOrgMember ? activeChip : 'external';

  const blockedIdSet = useMemo(
    () => new Set(blockedMembers.map(m => String(m.userId))),
    [blockedMembers],
  );

  const filteredMembers = useMemo(
    () => members.filter(m => !blockedIdSet.has(String(m.userId))),
    [members, blockedIdSet],
  );
  const filteredPinned = useMemo(
    () => pinnedMembers.filter(m => !blockedIdSet.has(String(m.userId))),
    [pinnedMembers, blockedIdSet],
  );

  // 정책 정렬: 한글→영문→숫자(1..9,0)→특수문자 + ko collator (정책 member.md — 서버 name,ASC로는 표현 불가)
  const displayMembers = useMemo(
    () =>
      [...scopeByChip(filteredMembers, effectiveChip)]
        .sort((a, b) => comparePolicyMemberName(a.name, b.name))
        .map(normalizeMember),
    [filteredMembers, effectiveChip],
  );

  // 신규 멤버(24h) — 차단·칩·검색이 적용된 목록 기준 (RN useNewMembers 패리티).
  // 만료 경계 시각에 자동 재판정해 24h가 지나면 섹션에서 사라진다 (+500ms jitter 버퍼).
  const [newMemberNowTick, setNewMemberNowTick] = useState(() => Date.now());
  const newMembers = useMemo(
    () => selectNewMembers(scopeByChip(filteredMembers, effectiveChip), newMemberNowTick),
    [filteredMembers, effectiveChip, newMemberNowTick],
  );
  useEffect(() => {
    if (newMembers.length === 0) return;
    const earliest = Math.min(...newMembers.map(m => getMemberNewSince(m) ?? 0));
    const delay = Math.max(0, earliest + NEW_MEMBER_WINDOW_MS + 500 - Date.now());
    const timer = setTimeout(() => setNewMemberNowTick(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [newMembers]);
  // 관심멤버도 칩별로 분기 (협력 칩 → 협력 pinned만) — 정책: 관심멤버 수는 탭별 표시
  const pinnedDisplay = useMemo(
    () => scopeByChip(filteredPinned, effectiveChip).map(normalizeMember),
    [filteredPinned, effectiveChip],
  );

  const hasContent = pinnedDisplay.length > 0 || displayMembers.length > 0;

  // 활성 칩별 섹션 헤더 라벨 (협력 칩 → '협력멤버', 사내 칩 → '사내멤버').
  // 게스트는 칩 UI가 없고 데이터도 협력멤버뿐이라 '협력멤버' 고정 (RN external 고정 패리티) —
  // 소속 계정이 남긴 모듈 칩 상태(lastActiveChip)가 게스트 세션 라벨에 새는 것도 함께 차단
  const memberSectionLabel = !isOrgMember
    ? '협력멤버'
    : activeChip === 'company'
      ? '사내멤버'
      : activeChip === 'external'
        ? '협력멤버'
        : '전체멤버';

  /** 행 id(prefix 포함) → 원본 MemberItem — 프로필 열기·우클릭 메뉴 공용 */
  const findMemberByRowId = useCallback(
    (id: string) => {
      const userId = id.replace(/^(company|external)-/, '');
      return members.find(m => String(m.userId) === userId) ?? null;
    },
    [members],
  );

  const handleMemberPress = useCallback(
    (id: string) => {
      const member = findMemberByRowId(id);
      if (member) setSelectedMember(member);
    },
    [findMemberByRowId],
  );

  return {
    isOrgMember, isSearchOpen, setIsSearchOpen,
    activeChip, setActiveChip, selectedMember, setSelectedMember,
    isMyProfileOpen, setIsMyProfileOpen, displayMembers, handleMemberPress, findMemberByRowId, isLoading,
    pinnedDisplay, hasContent, memberSectionLabel, newMembers,
    isInviteOpen, setIsInviteOpen,
    isStatusOpen, setIsStatusOpen, receivedInviteCount,
  };
}

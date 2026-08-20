'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { comparePolicyMemberName } from '@/features/members/policySort';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useGetMembers } from '@/features/members/queries';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import { MemberItem, USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import IconArrowBack from '@assets/icons/arrow_back.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCircleClose from '@assets/icons/circle-close.svg';
import { MemberListItem } from './MemberListItem';
import { normalizeMember, scopeByChip, type MemberChipType } from '../useMembersPage';

interface MemberSearchOverlayProps {
  onClose: () => void;
}

/**
 * 멤버 검색 풀스크린 화면 (RN MemberSearchScreen 방식 — 2026-08-20 사용자 확정).
 * - 헤더: ← 뒤로가기 + Searchbar(flex-1) — 타이틀 없음
 * - 본문: 흰 카드(rounded-t-2xl) 안에 [칩(사내멤버만) + "검색결과 (N)" + 리스트 | Empty]
 * - 칩 상태는 화면 진입마다 초기화 (멤버목록 칩과 비공유 — RN 별도 화면과 동일)
 * - 검색: 초성/자모 한글 검색 + 300ms 디바운스, 차단 멤버 제외
 * - 크기는 데스크톱 체계(검색바 40px 등). 행 우클릭 메뉴 미지원(사용자 결정 — 멤버목록에서만)
 */
export function MemberSearchOverlay({ onClose }: MemberSearchOverlayProps) {
  const user = useAuthStore(s => s.user);
  const isOrgMember = user?.userType === USER_TYPE.ORG_MEMBER;

  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeChip, setActiveChip] = useState<MemberChipType>(isOrgMember ? 'all' : 'external');
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const debouncedSetFilter = useDebounce(setFilterValue, 300);

  // ESC = 뒤로가기 — 위에 프로필 화면이 겹치면 최상단만 닫는다 (overlayStack)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const overlay = pushOverlay();
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && overlay.isTop()) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      release();
      overlay.release();
    };
  }, []);

  // 자동 포커스
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const { data: members = [] } = useGetMembers();
  const { data: blockedMembers = [] } = useGetBlockedMembers();

  // GUEST는 항상 'all' (서버가 협력멤버만 응답하므로 전체 = 협력멤버)
  const effectiveChip: MemberChipType = isOrgMember ? activeChip : 'all';

  const displayMembers = useMemo(() => {
    const blockedIds = new Set(blockedMembers.map(m => String(m.userId)));
    // 차단 상대 숨김 (정책 block.md — 검색에도 동일 적용)
    const visible = members.filter(m => !blockedIds.has(String(m.userId)));
    const filtered = filterByhangeulSearch(scopeByChip(visible, effectiveChip), filterValue, m => m.name);
    return [...filtered].sort((a, b) => comparePolicyMemberName(a.name, b.name)).map(normalizeMember);
  }, [members, blockedMembers, effectiveChip, filterValue]);

  const findMemberByRowId = (id: string) => {
    const userId = id.replace(/^(company|external)-/, '');
    return members.find(m => String(m.userId) === userId) ?? null;
  };

  const handleMemberPress = (id: string) => {
    const member = findMemberByRowId(id);
    if (member) setSelectedMember(member);
  };

  const handleClear = () => {
    setDisplayValue('');
    setFilterValue('');
    inputRef.current?.focus();
  };

  // 정적 no-drag 루트 + 내부 애니메이션 래퍼 (루트에 transform 금지 — 드래그 구멍 어긋남)
  return createPortal(
    <div className="electron-no-drag fixed inset-0 z-50">
      <div className="animate-overlay-in flex h-full flex-col bg-gray-50">
        {/* macOS 신호등 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {/* 헤더: ← + Searchbar (다른 오버레이 헤더와 동일한 52px) */}
        <div className="flex h-[52px] shrink-0 items-center gap-3 px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="뒤로가기"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconArrowBack width={24} height={24} />
          </button>
          {/* Searchbar — 데스크톱 크기 40px (RN 48px에서 축소), 회색 채움 + 포커스 시 돋보기 진하게 */}
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-gray-200 bg-gray-100 px-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <IconSearchDefault
                width={20}
                height={20}
                className={isFocused ? 'text-gray-900' : 'text-text-tertiary'}
              />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={displayValue}
              onChange={e => {
                setDisplayValue(e.target.value);
                debouncedSetFilter(e.target.value);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="멤버 검색"
              className="min-w-0 flex-1 bg-transparent text-body text-gray-900 outline-none placeholder:text-text-tertiary"
            />
            {/* 클리어: 포커스 중 + 값 있을 때만 — mousedown 억제로 blur 방지 */}
            {isFocused && displayValue.length > 0 && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={handleClear}
                aria-label="지우기"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60"
              >
                <IconCircleClose width={20} height={20} />
              </button>
            )}
          </div>
        </div>

        {/* 흰 카드: 헤더와 14px 간격, 칩/라벨/리스트 */}
        <div className="mt-3.5 flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface pt-3.5 shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
          {isOrgMember && (
            <div className="flex items-center gap-1.5 px-4 pb-3.5">
              <Chip label="전체" active={activeChip === 'all'} onClick={() => setActiveChip('all')} />
              <Chip label="사내멤버" active={activeChip === 'company'} onClick={() => setActiveChip('company')} />
              <Chip label="협력멤버" active={activeChip === 'external'} onClick={() => setActiveChip('external')} />
            </div>
          )}

          <div className="px-4 pb-3.5">
            <span className="text-sub-sm text-text-secondary">검색결과 ({displayMembers.length})</span>
          </div>

          {displayMembers.length === 0 ? (
            <EmptyState variant="search" message="찾으시는 멤버가 없어요." className="flex-1" />
          ) : (
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {/* 검색 결과 행은 우클릭 메뉴 미지원 (사용자 결정 — 클릭=프로필만) */}
              {displayMembers.map(item => (
                <MemberListItem
                  key={item.id}
                  member={item}
                  onClick={() => handleMemberPress(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 결과 행 클릭 → 멤버 프로필 (검색 화면 위에 겹침) */}
      <UserProfileDialog isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} member={selectedMember} />
    </div>,
    document.body,
  );
}

'use client';

import { TitleBarColorSync } from '@/shared/ui/TitleBarColorSync';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useAuthStore } from '@/store/auth/authStore';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCircleClose from '@assets/icons/circle-close.svg';
import { EMRoomItem } from './EMRoomItem';
import type { ChatSortType } from './ChatSettingsMenu';
import { emRoomFavoriteRank, lastActivityMs } from './chatRoomListUtils';

interface ExternalChatSearchOverlayProps {
  /** 진입 시점 값으로 고정 (RN 패리티 — 정렬은 협력채팅 탭에서만 변경 가능) */
  sortType: ChatSortType;
  onClose: () => void;
}

/**
 * 협력채팅 목록 검색 풀스크린 화면 (RN ExternalChatSearchScreen 패리티).
 * 헤더는 ✕(좌) + 중앙 타이틀 + 아래 줄 Searchbar (2026-09-03 사용자 결정 — 멤버 검색과 동일 구조).
 * 사내(ChatSearchOverlay)와 같은 골격이되 RN 사양 차이를 따른다:
 * - 칩·"검색결과 (N)" 라벨 없음 — 단순형
 * - 검색 대상은 **방 제목만** (참여자 이름 미포함), 초성 매칭 + 300ms 디바운스
 * - 결과 0건은 회색 배경 정중앙 Empty (흰 카드 없음), 결과 있으면 흰 라운드 패널
 */
export function ExternalChatSearchOverlay({ sortType, onClose }: ExternalChatSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debouncedSetFilter = useDebounce(setFilterValue, 300);

  // ESC = 뒤로가기 (겹침 시 최상단만 — overlayStack)
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

  const { data: emRooms = [] } = useGetEMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const myUserId = useAuthStore(s => s.user?.id);

  const pinnedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    pinnedMembers.forEach((m, i) => map.set(String(m.userId), i));
    return map;
  }, [pinnedMembers]);

  // 목록 사이드바와 동일 정렬(진입 시점 고정) 후 방 제목만 검색 (RN — title 기반 한글 검색)
  const visibleRooms = useMemo(() => {
    const sorted = [...emRooms].sort((a, b) => {
      if (sortType === 'favorite') {
        const ra = emRoomFavoriteRank(a, pinnedRankMap);
        const rb = emRoomFavoriteRank(b, pinnedRankMap);
        if (ra !== rb) return ra - rb;
      }
      return lastActivityMs(b) - lastActivityMs(a);
    });
    return filterByhangeulSearch(sorted, filterValue, room => room.roomModel.title ?? '');
  }, [emRooms, sortType, pinnedRankMap, filterValue]);

  const handleClear = () => {
    setDisplayValue('');
    setFilterValue('');
    inputRef.current?.focus();
  };

  // 정적 no-drag 루트 + 내부 애니메이션 래퍼 (루트에 transform 금지 — 드래그 구멍 어긋남)
  return createPortal(
    <div className="electron-no-drag fixed inset-0 z-50">
      <div className="animate-overlay-in flex h-full flex-col bg-gray-50">
        {/* 창 버튼(WCO) 영역을 gray-50 상단과 동기화 */}
        <TitleBarColorSync color="#F8F9FA" />
        {/* macOS 신호등 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {/* 헤더: ✕(좌) + 중앙 타이틀 — ProfileDialogShell(초대현황) 헤더와 동일 규격 (52px) */}
        <div className="relative h-[52px] shrink-0">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[100px]">
            <h2 className="truncate text-heading-md font-medium text-text-primary">협력채팅 검색</h2>
          </div>
          <div className="flex h-full items-center px-4">
            {/* ✕는 획이 사방으로 뻗어 ←보다 커 보임 — 20px로 시각 균형 (셸과 동일 규칙) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="z-10 flex h-8 w-8 items-center justify-center text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconCloseStroke width={20} height={20} />
            </button>
          </div>
        </div>

        {/* Searchbar — 타이틀 아래 별도 줄 (멤버 검색과 동일 구조) */}
        <div className="shrink-0 px-4">
          <div className="flex h-10 min-w-0 items-center gap-2.5 rounded-[10px] border border-gray-200 bg-gray-100 px-3.5">
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
              placeholder="채팅방 이름 검색"
              className="min-w-0 flex-1 bg-transparent text-body text-gray-900 outline-none placeholder:text-text-tertiary"
            />
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

        {visibleRooms.length === 0 ? (
          /* RN 패리티 — 결과 0건은 회색 배경 정중앙 (흰 카드 없음) */
          <EmptyState variant="search" message="검색 결과가 없어요." className="flex-1" />
        ) : (
          /* 흰 카드: 결과 목록 (RN — 칩/카운트 라벨 없이 목록 바로 시작) */
          <div className="mt-3.5 flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {/* 행 클릭(방 이동) 시 검색 화면 닫기 — 우클릭 메뉴/컨펌은 포털이라 미해당 */}
              {visibleRooms.map(room => (
                <div key={room.roomModel.roomId} onClick={() => onClose()}>
                  <EMRoomItem
                    room={room}
                    myUserId={myUserId}
                    pinnedRankMap={pinnedRankMap}
                    showFavoriteStar={sortType === 'favorite'}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

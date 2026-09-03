'use client';

import { TitleBarColorSync } from '@/shared/ui/TitleBarColorSync';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGetDMRoomList, useGetGMRoomList } from '@/features/chat-room-list/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState } from '@/shared/ui/EmptyState';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCircleClose from '@assets/icons/circle-close.svg';
import { ChatRoomItem } from './ChatRoomItem';
import type { ChatSortType } from './ChatSettingsMenu';
import {
  COMPANY_CHAT_CHIPS,
  lastActivityMs,
  roomFavoriteRank,
  roomSearchText,
  type ChatChip,
  type TaggedRoom,
} from './chatRoomListUtils';

interface ChatSearchOverlayProps {
  /** 진입 시점의 목록 칩 — 검색 화면 로컬 상태로만 변경 (사이드바 칩에 미반영, RN 패리티) */
  initialChip: ChatChip;
  /** 진입 시점 값으로 고정 (RN 패리티) */
  sortType: ChatSortType;
  onClose: () => void;
}

/**
 * 사내채팅 목록 검색 풀스크린 화면 (RN CompanyChatSearchScreen 패리티).
 * - 헤더: ✕(좌) + 중앙 타이틀 — 초대현황(ProfileDialogShell) 헤더 패턴,
 *   Searchbar는 타이틀 아래 별도 줄 (2026-09-03 사용자 결정 — 멤버 검색과 동일 구조)
 * - 본문: 흰 카드 안에 [칩(전체/1:1/그룹) + "검색결과 (N)" + 방 목록 | Empty]
 * - 행은 목록과 동일(ChatRoomItem) — hover 나가기·우클릭 메뉴도 그대로 동작
 * - 검색: 방 이름 + 상대 이름 초성 매칭, 300ms 디바운스
 */
export function ChatSearchOverlay({ initialChip, sortType, onClose }: ChatSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // 칩 전환 시 결과 리스트 최상단으로 (RN scrollToOffset(0) 패리티)
  const resultListRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeChip, setActiveChip] = useState<ChatChip>(initialChip);
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

  const { data: dmRooms = [] } = useGetDMRoomList();
  const { data: gmRooms = [] } = useGetGMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();

  const pinnedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    pinnedMembers.forEach((m, i) => map.set(String(m.userId), i));
    return map;
  }, [pinnedMembers]);

  // 목록 사이드바와 동일한 병합·정렬 후 검색 필터 (정렬은 진입 시점 sortType 고정)
  const visibleRooms = useMemo<TaggedRoom[]>(() => {
    const dmTagged: TaggedRoom[] = dmRooms.map(room => ({ room, channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE }));
    const gmTagged: TaggedRoom[] = gmRooms.map(room => ({ room, channelType: WS_CHANNEL_TYPE.GROUP_MESSAGE }));
    const base =
      activeChip === 'dm' ? dmTagged : activeChip === 'gm' ? gmTagged : [...dmTagged, ...gmTagged];

    const sorted = [...base].sort((a, b) => {
      if (sortType === 'favorite') {
        const ra = roomFavoriteRank(a, pinnedRankMap);
        const rb = roomFavoriteRank(b, pinnedRankMap);
        if (ra !== rb) return ra - rb;
      }
      return lastActivityMs(b.room) - lastActivityMs(a.room);
    });

    return filterByhangeulSearch(sorted, filterValue, ({ room }) => roomSearchText(room));
  }, [dmRooms, gmRooms, activeChip, sortType, pinnedRankMap, filterValue]);

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
            <h2 className="truncate text-heading-md font-medium text-text-primary">사내채팅 검색</h2>
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
              placeholder="채팅방명 또는 상대방 이름 검색"
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

        {/* 흰 카드: 칩 + 검색결과 (N) + 목록 */}
        <div className="mt-3.5 flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface pt-3.5 shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-1.5 px-4 pb-3.5">
            {COMPANY_CHAT_CHIPS.map(chip => (
              <Chip
                key={chip.key}
                label={chip.label}
                active={activeChip === chip.key}
                onClick={() => { setActiveChip(chip.key); resultListRef.current?.scrollTo({ top: 0 }); }}
              />
            ))}
          </div>

          <div className="px-4 pb-3.5">
            <span className="text-sub-sm text-text-secondary">검색결과 ({visibleRooms.length})</span>
          </div>

          {visibleRooms.length === 0 ? (
            <EmptyState variant="search" message="검색 결과가 없어요." className="flex-1" />
          ) : (
            <div ref={resultListRef} className="scrollbar-thin flex-1 overflow-y-auto">
              {/* 행 클릭(방 이동) 시 검색 화면 닫기 — 나가기 버튼은 stopPropagation, 메뉴/컨펌은 포털이라 미해당 */}
              {visibleRooms.map(({ room, channelType }) => (
                <div key={room.roomModel.roomId} onClick={() => onClose()}>
                  <ChatRoomItem
                    room={room}
                    channelType={channelType}
                    pinnedRankMap={pinnedRankMap}
                    showFavoriteStar={sortType === 'favorite'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

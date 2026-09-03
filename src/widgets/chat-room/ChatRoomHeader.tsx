'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import IconCircleClose from '@assets/icons/circle-close.svg';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import { IconCalender } from '@assets/icons';
import { CalendarPopover } from './CalendarPopover';
import { IconChevronDown, IconChevronLeft, IconChevronUp, IconSidePanel } from '@/shared/ui/icons';
import IconSearchDefault from '@assets/icons/search-default.svg';
import type { UseChatRoomSearchReturn } from '@/features/chat-room/useChatRoomSearch';
import { apiGetDMActiveDates, apiGetEMActiveDates, apiGetGMActiveDates } from '@/features/chat-room/api';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

interface ChatRoomHeaderProps {
  roomName: string;
  totalUserCount: number;
  /** EM(협력채팅) 방 여부 — 타이틀 옆 ∞ 심볼 표기 (RN 패리티) */
  isExternalRoom?: boolean;
  onBack: () => void;
  /** 멀티 채팅창(팝업) — 돌아갈 목록이 없어 뒤로가기 미노출 */
  isPopup?: boolean;
  search: UseChatRoomSearchReturn;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  /** draft 방(첫 메시지 전, roomId 없음) — 방 생성 전이라 사이드패널 열기 비활성 (RN 패리티) */
  isSidePanelDisabled?: boolean;
  /** 캘린더 날짜 검색 — 선택한 날짜 첫 메시지로 점프 (RN 패리티) */
  onCalendarDateSelect: (date: Date) => void;
  isCalendarLoading?: boolean;
}

export function ChatRoomHeader({
  roomName,
  totalUserCount,
  isExternalRoom,
  onBack,
  isPopup = false,
  search,
  searchInputRef,
  isSidePanelOpen,
  onToggleSidePanel,
  isSidePanelDisabled = false,
  onCalendarDateSelect,
  isCalendarLoading,
}: ChatRoomHeaderProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // 직전 점프 날짜 — 캘린더 재오픈 시 하이라이트 (RN selectedDateKey 복원 패리티)
  const [selectedJumpDate, setSelectedJumpDate] = useState<Date | null>(null);
  // 메시지 0건이면 검색 버튼 비활성 (RN 패리티)
  const hasMessages = useChatRoomRuntimeStore(s => s.messages.length > 0);
  // 인원수는 GM/EM만 — DM 헤더는 상대 이름 단독 (RN 패리티)
  const isDM = useChatRoomInfo(s => s.channelType) === WS_CHANNEL_TYPE.DIRECT_MESSAGE;
  // 대화가 있는 날짜만 달력에서 활성화 (RN activeDates 패리티) — null = 조회 실패·미조회(게이팅 없음)
  const [activeDates, setActiveDates] = useState<Set<string> | null>(null);

  const loadActiveDates = async () => {
    const { roomId, channelType } = useChatRoomInfo.getState();
    if (!roomId) return;
    try {
      const apiGetActiveDates =
        channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE
          ? apiGetGMActiveDates
          : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
            ? apiGetEMActiveDates
            : apiGetDMActiveDates;
      const res = await apiGetActiveDates(roomId);
      const dates = new Set<string>();
      res.payload.items.forEach(yearItem => {
        yearItem.months.forEach(monthItem => {
          monthItem.days.forEach(day => {
            dates.add(`${yearItem.year}-${String(monthItem.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
          });
        });
      });
      // 오늘 날짜는 서버 배치 전 — 오늘 메시지가 있으면 수동 추가 (RN 패리티)
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const hasTodayMessage = useChatRoomRuntimeStore.getState().messages.some(msg => {
        if (!msg.createdAt) return false;
        const d = new Date(msg.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayKey;
      });
      if (hasTodayMessage) dates.add(todayKey);
      setActiveDates(dates);
    } catch {
      // 조회 실패 시 게이팅 없이 열림 (RN은 로컬 메시지 폴백 — 데스크톱은 전체 허용 폴백)
      setActiveDates(null);
    }
  };
  return (
    <header className="electron-drag bg-chat-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* 팝업(멀티 채팅창)은 대화 단독 창 — 목록으로 나가는 뒤로가기 숨김 */}
          {!isPopup && (
            <button
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconChevronLeft />
            </button>
          )}
          {/* RN 패리티 — 타이틀 heading-md(18) medium + 인원수 text-body(16) semibold 인라인 */}
          {/* 간격 6px — RN은 ml-1(4px)이지만 데스크톱 가독성으로 소폭 넓힘 (사용자 결정 2026-09-01) */}
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-heading-md font-medium leading-tight text-gray-900">{roomName || '채팅방'}</h2>
            {/* RN ChatRoomScreen 순서 — 제목 → 인원수 → ∞ (심볼이 뒤). 색도 RN과 동일한 text.primary */}
            {!isDM && totalUserCount > 0 && (
              <span className="shrink-0 text-body font-semibold text-gray-900">{totalUserCount}</span>
            )}
            {/* EM(협력채팅) 구분 심볼 (RN 패리티) */}
            {isExternalRoom && <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              if (search.isSearchMode) {
                search.exitSearchMode();
              } else {
                search.enterSearchMode();
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            // RN 패리티 — 메시지 0건이면 검색 진입 비활성
            disabled={!hasMessages && !search.isSearchMode}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-30',
              search.isSearchMode ? 'bg-black/10 text-gray-900' : 'text-gray-900 hover:opacity-70 active:opacity-60',
            )}
          >
            {/* 디자인 에셋 22px — RN(24) 대비 데스크톱 헤더 밀도에 맞춰 소폭 축소 (사용자 결정 2026-09-01) */}
            <IconSearchDefault width={22} height={22} />
          </button>
          <button
            onClick={onToggleSidePanel}
            // RN 패리티 — draft 방(방 생성 전)은 사이드패널 열기 불가
            disabled={isSidePanelDisabled}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-30',
              isSidePanelOpen ? 'bg-black/10 text-gray-900' : 'text-gray-900 hover:opacity-70 active:opacity-60',
            )}
          >
            {/* 돋보기(22px 에셋)와 시각 균형 */}
            <IconSidePanel size={22} />
          </button>
        </div>
      </div>
      {/* 검색바 */}
      {search.isSearchMode && (
        <div className="electron-no-drag flex items-center gap-2 border-t border-divider px-4 py-2">
          {/* 날짜 검색 (달력) — 특정 날짜 첫 메시지로 점프 (RN SearchResultNavigation 패리티) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !isCalendarOpen;
                setIsCalendarOpen(next);
                if (next) void loadActiveDates();
              }}
              disabled={isCalendarLoading}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded transition-colors',
                isCalendarOpen ? 'bg-black/10 text-gray-900' : 'text-gray-700 hover:opacity-70 active:opacity-60',
                isCalendarLoading && 'opacity-50',
              )}
              aria-label="날짜로 이동"
            >
              <IconCalender width={18} height={18} />
            </button>
            <CalendarPopover
              open={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              onSelectDate={date => {
                setSelectedJumpDate(date);
                onCalendarDateSelect(date);
              }}
              activeDates={activeDates}
              selectedDate={selectedJumpDate}
            />
          </div>
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={search.searchKeyword}
              onChange={e => search.handleSearchKeywordChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  // 같은 키워드로 검색이 끝난 상태의 엔터 = 다음 결과(과거 방향, ▲과 동일)로 이동,
                  // Shift+엔터 = 반대 방향 — 브라우저/카톡 검색 관례 (2026-09-03 사용자 요청).
                  // 키워드가 바뀌었거나 첫 엔터면 기존대로 검색 실행.
                  const sameSearchDone =
                    !search.isSearching &&
                    search.totalCount > 0 &&
                    search.searchKeyword.trim() === search.activeSearchKeyword.trim();
                  if (sameSearchDone) {
                    if (e.shiftKey) { if (search.canGoNext) search.goToNext(); }
                    else if (search.canGoPrev) search.goToPrevious();
                  } else {
                    search.handleSearchSubmit(search.searchKeyword);
                  }
                }
                if (e.key === 'Escape') search.exitSearchMode();
              }}
              placeholder="대화 내용 · 파일명 검색"
              className="h-10 w-full rounded-md border border-divider bg-gray-50 px-3 pr-8 text-sub text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
            />
            {/* 키워드만 지우기 — 검색 모드는 유지 (RN 검색바 X 패리티, 우측 ✕는 모드 종료) */}
            {search.searchKeyword.length > 0 && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  search.handleSearchKeywordChange('');
                  searchInputRef.current?.focus();
                }}
                aria-label="검색어 지우기"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-text-tertiary transition-opacity hover:opacity-70"
              >
                <IconCircleClose width={16} height={16} />
              </button>
            )}
          </div>
          {search.totalCount > 0 && (
            <span className="shrink-0 text-sub-sm text-text-secondary">
              {search.displayIndex}/{search.totalCount}
            </span>
          )}
          {search.isSearching && (
            <span className="shrink-0 text-sub-sm text-text-tertiary">검색 중...</span>
          )}
          {/* 완주 0건일 때만 표기 — 검색 전/취소와 구분 (RN C5 패리티) */}
          {!search.isSearching && search.hasSearched && search.totalCount === 0 && (
            <span className="shrink-0 text-sub-sm font-medium text-gray-700">검색결과 없음</span>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={search.goToPrevious}
              disabled={!search.canGoPrev}
              className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-30"
            >
              {/* 기본 14px는 28px 버튼에서 왜소 — 20px로 (2026-09-03 사용자 QA) */}
              <IconChevronUp size={20} />
            </button>
            <button
              onClick={search.goToNext}
              disabled={!search.canGoNext}
              className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-30"
            >
              <IconChevronDown size={20} />
            </button>
          </div>
          <button
            onClick={search.exitSearchMode}
            className="flex h-7 w-7 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconCloseStroke width={14} height={14} />
          </button>
        </div>
      )}
    </header>
  );
}

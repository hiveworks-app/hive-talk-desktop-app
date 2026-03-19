'use client';

import { cn } from '@/shared/lib/cn';
import { IconChevronDown, IconChevronLeft, IconChevronUp, IconClose, IconPerson, IconSearch, IconSidePanel } from '@/shared/ui/icons';
import type { UseChatRoomSearchReturn } from '@/features/chat-room/useChatRoomSearch';

interface ChatRoomHeaderProps {
  roomName: string;
  totalUserCount: number;
  onBack: () => void;
  search: UseChatRoomSearchReturn;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
}

export function ChatRoomHeader({
  roomName,
  totalUserCount,
  onBack,
  search,
  searchInputRef,
  isSidePanelOpen,
  onToggleSidePanel,
}: ChatRoomHeaderProps) {
  return (
    <header className="electron-drag border-b border-divider">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="electron-no-drag flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-gray-100 md:hidden"
          >
            <IconChevronLeft />
          </button>
          <div className="flex flex-col">
            <h2 className="text-heading-sm font-bold leading-tight text-text-primary">{roomName || '채팅방'}</h2>
            {totalUserCount > 0 && (
              <span className="flex items-center gap-0.5 text-sub-sm text-text-tertiary">
                <IconPerson size={12} />
                {totalUserCount}
              </span>
            )}
          </div>
        </div>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={() => {
              if (search.isSearchMode) {
                search.exitSearchMode();
              } else {
                search.enterSearchMode();
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded transition-colors',
              search.isSearchMode ? 'bg-gray-200 text-text-primary' : 'text-text-tertiary hover:bg-gray-100',
            )}
          >
            <IconSearch />
          </button>
          <button
            onClick={onToggleSidePanel}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded transition-colors',
              isSidePanelOpen ? 'bg-gray-200 text-text-primary' : 'text-text-tertiary hover:bg-gray-100',
            )}
          >
            <IconSidePanel />
          </button>
        </div>
      </div>
      {/* 검색바 */}
      {search.isSearchMode && (
        <div className="flex items-center gap-2 border-t border-divider px-4 py-2">
          <input
            ref={searchInputRef}
            type="text"
            value={search.searchKeyword}
            onChange={e => search.handleSearchKeywordChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') search.handleSearchSubmit(search.searchKeyword);
              if (e.key === 'Escape') search.exitSearchMode();
            }}
            placeholder="메시지 검색..."
            className="flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
          />
          {search.totalCount > 0 && (
            <span className="shrink-0 text-sub-sm text-text-secondary">
              {search.displayIndex}/{search.totalCount}
            </span>
          )}
          {search.isSearching && (
            <span className="shrink-0 text-sub-sm text-text-tertiary">검색 중...</span>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={search.goToPrevious}
              disabled={!search.canGoPrev}
              className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-gray-100 disabled:opacity-30"
            >
              <IconChevronUp />
            </button>
            <button
              onClick={search.goToNext}
              disabled={!search.canGoNext}
              className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-gray-100 disabled:opacity-30"
            >
              <IconChevronDown />
            </button>
          </div>
          <button
            onClick={search.exitSearchMode}
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}
    </header>
  );
}

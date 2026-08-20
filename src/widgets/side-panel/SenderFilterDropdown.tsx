'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFileSendersInfiniteQuery } from '@/features/chat-room-side-panel/queries';
import type { FileSenderContentType } from '@/features/chat-room-side-panel/type';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/Checkbox';
import { IconChevronDown, IconSearch } from '@/shared/ui/icons';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface SenderFilterDropdownProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  contentType: FileSenderContentType[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * 사이드패널 보낸사람 서버 필터 드롭다운 (RN SidePanelSenderSearchDropdown 대응).
 * GET /app/chat/files/senders 로 해당 방·타입의 파일을 보낸 유저를 검색해 다중 선택한다.
 */
export function SenderFilterDropdown({
  roomId,
  channelType,
  contentType,
  selectedIds,
  onChange,
}: SenderFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    ...getFileSendersInfiniteQuery({ roomId, channelType, contentType, keyword: debouncedKeyword }),
    enabled: open && !!roomId,
  });
  const senders = data?.pages.flatMap(p => p.items) ?? [];

  const toggle = (userId: string) => {
    const id = String(userId);
    onChange(
      selectedIds.includes(id) ? selectedIds.filter(v => v !== id) : [...selectedIds, id],
    );
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sub-sm transition-colors',
          selectedIds.length > 0
            ? 'bg-[#E6F3FF] font-medium text-primary'
            : 'bg-gray-100 text-text-secondary hover:bg-gray-150',
        )}
      >
        보낸사람{selectedIds.length > 0 ? ` ${selectedIds.length}` : ''}
        <IconChevronDown />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl border border-divider bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
            <IconSearch size={14} className="text-text-tertiary" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="이름 검색"
              className="min-w-0 flex-1 bg-transparent text-sub-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="shrink-0 text-sub-sm text-text-tertiary hover:text-text-primary"
              >
                초기화
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-64 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sub-sm text-text-tertiary">로딩 중...</div>
            ) : senders.length === 0 ? (
              <div className="px-3 py-4 text-center text-sub-sm text-text-tertiary">
                보낸사람이 없습니다
              </div>
            ) : (
              senders.map(sender => {
                const id = String(sender.userId);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <Checkbox checked={selectedIds.includes(id)} size="md" />
                    <ProfileCircle name={sender.name} size="sm" storageKey={sender.thumbnailProfileUrl ?? null} />
                    <span className="min-w-0 flex-1 truncate text-sub text-text-primary">{sender.name}</span>
                  </button>
                );
              })
            )}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-1.5 text-sub-sm text-primary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-50"
              >
                {isFetchingNextPage ? '로딩 중...' : '더 보기'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

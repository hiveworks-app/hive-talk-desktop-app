'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeAttachmentQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/Checkbox';
import { IconDownload, IconSearch } from '@/shared/ui/icons';
import { Spinner } from '@/shared/ui/Spinner';
import type { MediaListType } from '@/shared/types/media';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface MediaTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

const fileNameOf = (media: MediaListType) => media.path.split('/').pop() || '미디어';

export function MediaTab({ roomId, channelType, lastMessageId }: MediaTabProps) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
  );
  const { download, downloadingId, downloadMany, bulkDownloading } = useFileDownload();
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allMedia: MediaListType[] = data?.pages.flat() ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allMedia.filter(m => {
        const name = fileNameOf(m).toLowerCase();
        return name.includes(q) || (m.author ?? '').toLowerCase().includes(q);
      })
    : allMedia;

  const allSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(m => m.id)));
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const handleBulkDownload = () => {
    const items = filtered
      .filter(m => selected.has(m.id))
      .map(m => ({ url: m.presignedUrl ?? m.path, filename: fileNameOf(m) }));
    downloadMany(items);
  };

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allMedia.length === 0) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">사진/동영상이 없습니다</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더: 검색 / 선택 모드 툴바 */}
      {selectMode ? (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-divider bg-background px-3 py-2">
          <button type="button" onClick={exitSelect} className="text-sub-sm text-text-secondary hover:text-text-primary">
            취소
          </button>
          <span className="text-sub-sm text-text-tertiary">{selected.size}개 선택</span>
          <button type="button" onClick={toggleAll} className="text-sub-sm text-primary hover:underline">
            {allSelected ? '선택 해제' : '전체 선택'}
          </button>
        </div>
      ) : (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-divider bg-background px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5">
            <IconSearch size={14} className="text-text-tertiary" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="보낸사람 검색"
              className="min-w-0 flex-1 bg-transparent text-sub-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>
          <button type="button" onClick={() => setSelectMode(true)} className="shrink-0 text-sub-sm text-primary hover:underline">
            선택
          </button>
        </div>
      )}

      <div className="flex-1 px-4 py-2">
        {q && filtered.length === 0 ? (
          <div className="py-8 text-center text-sub-sm text-text-tertiary">검색 결과가 없습니다</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {filtered.map(media => {
              const fileName = fileNameOf(media);
              const isChecked = selected.has(media.id);
              const thumb = (
                <img
                  src={media.thumbnailPresignedUrl || media.presignedUrl || media.path}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              );
              return (
                <div key={media.id} className="group relative aspect-square overflow-hidden rounded bg-gray-100">
                  {selectMode ? (
                    <button type="button" onClick={() => toggle(media.id)} className="block h-full w-full">
                      {thumb}
                      <span className="absolute left-1 top-1">
                        <Checkbox checked={isChecked} size="md" />
                      </span>
                      {isChecked && <span className="absolute inset-0 bg-primary/25 ring-2 ring-inset ring-primary" />}
                    </button>
                  ) : (
                    <>
                      <a href={media.presignedUrl || media.path} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                        {thumb}
                      </a>
                      <button
                        type="button"
                        onClick={() => download(media.id, media.presignedUrl ?? media.path, fileName)}
                        disabled={downloadingId === media.id}
                        className="absolute right-1 top-1 hidden rounded-full bg-black/55 p-1.5 text-white transition-colors hover:bg-black/75 group-hover:flex disabled:opacity-50"
                        aria-label="다운로드"
                      >
                        <IconDownload size={14} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-2 w-full py-2 text-sub-sm text-primary hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? '로딩 중...' : '더 보기'}
          </button>
        )}
      </div>

      {/* 선택 모드 하단 일괄 다운로드 바 */}
      {selectMode && selected.size > 0 && (
        <div className="sticky bottom-0 border-t border-divider bg-background p-3">
          <button
            type="button"
            onClick={handleBulkDownload}
            disabled={bulkDownloading}
            className={cn('flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled')}
          >
            {bulkDownloading ? <Spinner /> : <IconDownload size={16} />}
            {bulkDownloading ? '다운로드 중...' : `${selected.size}개 다운로드`}
          </button>
        </div>
      )}
    </div>
  );
}

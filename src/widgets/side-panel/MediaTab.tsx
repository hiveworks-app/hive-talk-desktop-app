'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeAttachmentQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { IconDownload, IconSearch } from '@/shared/ui/icons';
import type { MediaListType } from '@/shared/types/media';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface MediaTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

export function MediaTab({ roomId, channelType, lastMessageId }: MediaTabProps) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
  );
  const { download, downloadingId } = useFileDownload();
  const [query, setQuery] = useState('');

  const allMedia: MediaListType[] = data?.pages.flat() ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allMedia.filter(m => {
        const name = (m.path.split('/').pop() ?? '').toLowerCase();
        return name.includes(q) || (m.author ?? '').toLowerCase().includes(q);
      })
    : allMedia;

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allMedia.length === 0) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">사진/동영상이 없습니다</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-divider bg-background px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5">
          <IconSearch size={14} className="text-text-tertiary" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="보낸사람 검색"
            className="min-w-0 flex-1 bg-transparent text-sub-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>

      <div className="px-4 py-2">
        {q && filtered.length === 0 ? (
          <div className="py-8 text-center text-sub-sm text-text-tertiary">검색 결과가 없습니다</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {filtered.map(media => {
              const fileName = media.path.split('/').pop() || '미디어';
              return (
                <div key={media.id} className="group relative aspect-square overflow-hidden rounded bg-gray-100">
                  <a
                    href={media.presignedUrl || media.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full w-full"
                  >
                    <img
                      src={media.thumbnailPresignedUrl || media.presignedUrl || media.path}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
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
    </div>
  );
}

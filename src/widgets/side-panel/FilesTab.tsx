'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeFileQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { IconDownload, IconSearch } from '@/shared/ui/icons';
import { Spinner } from '@/shared/ui/Spinner';
import type { MediaListType } from '@/shared/types/media';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface FilesTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

export function FilesTab({ roomId, channelType, lastMessageId }: FilesTabProps) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    getSidePanelBeforeFileQuery(roomId, lastMessageId, channelType),
  );
  const { download, downloadingId } = useFileDownload();
  const [query, setQuery] = useState('');

  const allFiles: MediaListType[] = data?.pages.flat() ?? [];
  const q = query.trim().toLowerCase();
  // 서버 sender 필터 파라미터가 없어 로드된 페이지에 대해 파일명/보낸사람 클라이언트 필터
  const filtered = q
    ? allFiles.filter(f => {
        const name = (f.path.split('/').pop() ?? '').toLowerCase();
        return name.includes(q) || (f.author ?? '').toLowerCase().includes(q);
      })
    : allFiles;

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allFiles.length === 0) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">파일이 없습니다</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-divider bg-background px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5">
          <IconSearch size={14} className="text-text-tertiary" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="파일명·보낸사람 검색"
            className="min-w-0 flex-1 bg-transparent text-sub-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>

      <div className="py-1">
        {q && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">검색 결과가 없습니다</div>
        )}
        {filtered.map(file => {
          const fileName = file.path.split('/').pop() || '파일';
          const isDownloading = downloadingId === file.id;
          return (
            <div key={file.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-sub-sm text-text-tertiary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sub text-text-primary">{fileName}</div>
                <div className="truncate text-sub-sm text-text-tertiary">
                  {file.author}{file.fileSize ? ` · ${(file.fileSize / 1024).toFixed(1)}KB` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => download(file.id, file.presignedUrl ?? file.path, fileName)}
                disabled={isDownloading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-gray-100 hover:text-primary disabled:opacity-50"
                aria-label="다운로드"
              >
                {isDownloading ? <Spinner /> : <IconDownload size={16} />}
              </button>
            </div>
          );
        })}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-2 text-sub-sm text-primary hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? '로딩 중...' : '더 보기'}
          </button>
        )}
      </div>
    </div>
  );
}

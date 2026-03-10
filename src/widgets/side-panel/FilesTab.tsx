'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeFileQuery } from '@/features/chat-room-side-panel/queries';
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

  const allFiles: MediaListType[] = data?.pages.flat() ?? [];

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allFiles.length === 0) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">파일이 없습니다</div>;
  }

  return (
    <div className="py-1">
      {allFiles.map(file => {
        const fileName = file.path.split('/').pop() || '파일';
        return (
          <a
            key={file.id}
            href={file.presignedUrl || file.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-sub-sm text-text-tertiary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sub text-text-primary">{fileName}</div>
              <div className="text-sub-sm text-text-tertiary">
                {file.author} · {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)}KB` : ''}
              </div>
            </div>
          </a>
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
  );
}

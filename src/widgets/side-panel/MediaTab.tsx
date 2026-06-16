'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeAttachmentQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { IconDownload } from '@/shared/ui/icons';
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

  const allMedia: MediaListType[] = data?.pages.flat() ?? [];

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allMedia.length === 0) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">사진/동영상이 없습니다</div>;
  }

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-3 gap-1">
        {allMedia.map(media => {
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
  );
}

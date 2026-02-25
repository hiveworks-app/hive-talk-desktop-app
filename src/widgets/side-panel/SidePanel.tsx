'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  getSidePanelBeforeAttachmentQuery,
  getSidePanelBeforeFileQuery,
  getSidePanelParticipantsQuery,
} from '@/features/chat-room-side-panel/queries';
import { cn } from '@/shared/lib/cn';
import { MediaListType } from '@/shared/types/media';
import { WebSocketChannelTypes } from '@/shared/types/websocket';

type SidePanelTab = 'participants' | 'media' | 'files';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

export function SidePanel({ isOpen, onClose, roomId, channelType, lastMessageId }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('participants');

  return (
    <>
      {/* 모바일 오버레이 배경 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'shrink-0 border-l border-divider bg-background transition-all duration-200',
          // 모바일: 오버레이, 데스크톱: 사이드에 붙음
          isOpen
            ? 'fixed inset-y-0 right-0 z-40 w-[300px] md:relative md:z-auto md:w-[320px]'
            : 'w-0 overflow-hidden border-l-0',
        )}
      >
        {isOpen && (
          <div className="flex h-full flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h3 className="text-sm font-bold text-text-primary">채팅방 정보</h3>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex border-b border-divider">
            {(['participants', 'media', 'files'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                {tab === 'participants' ? '참여자' : tab === 'media' ? '사진/동영상' : '파일'}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {activeTab === 'participants' && (
              <ParticipantsTab roomId={roomId} channelType={channelType} />
            )}
            {activeTab === 'media' && (
              <MediaTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            )}
            {activeTab === 'files' && (
              <FilesTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function ParticipantsTab({
  roomId,
  channelType,
}: {
  roomId: string;
  channelType: WebSocketChannelTypes;
}) {
  const { data: participants = [], isLoading } = useQuery(
    getSidePanelParticipantsQuery(roomId, channelType),
  );

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-text-tertiary">로딩 중...</div>;
  }

  return (
    <div className="py-1">
      <div className="px-4 py-2 text-xs text-text-tertiary">
        참여자 {participants.length}명
      </div>
      {participants.map(p => (
        <div key={p.userId} className="flex items-center gap-3 px-4 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-text-secondary">
            {p.name.charAt(0)}
          </div>
          <span className="text-sm text-text-primary">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function MediaTab({
  roomId,
  channelType,
  lastMessageId,
}: {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
  );

  const allMedia: MediaListType[] = data?.pages.flat() ?? [];

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-text-tertiary">로딩 중...</div>;
  }

  if (allMedia.length === 0) {
    return <div className="px-4 py-8 text-center text-xs text-text-tertiary">사진/동영상이 없습니다</div>;
  }

  return (
    <div className="p-2">
      <div className="grid grid-cols-3 gap-1">
        {allMedia.map(media => (
          <a
            key={media.id}
            href={media.presignedUrl || media.path}
            target="_blank"
            rel="noopener noreferrer"
            className="relative aspect-square overflow-hidden rounded bg-gray-100"
          >
            <img
              src={media.thumbnailPresignedUrl || media.presignedUrl || media.path}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </a>
        ))}
      </div>
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-2 w-full py-2 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? '로딩 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}

function FilesTab({
  roomId,
  channelType,
  lastMessageId,
}: {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    getSidePanelBeforeFileQuery(roomId, lastMessageId, channelType),
  );

  const allFiles: MediaListType[] = data?.pages.flat() ?? [];

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-text-tertiary">로딩 중...</div>;
  }

  if (allFiles.length === 0) {
    return <div className="px-4 py-8 text-center text-xs text-text-tertiary">파일이 없습니다</div>;
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-text-tertiary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text-primary">{fileName}</div>
              <div className="text-xs text-text-tertiary">
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
          className="w-full py-2 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? '로딩 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}

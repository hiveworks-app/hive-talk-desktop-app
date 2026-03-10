'use client';

import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import { ChatImageGrid } from '@/shared/ui/ChatImageGrid';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { UploadDimOverlay } from '@/shared/ui/UploadDimOverlay';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { DateSeparator } from './DateSeparator';

interface MessageBubbleProps {
  message: ChatMessageUI;
  prevMessage?: ChatMessageUI;
  nextMessage?: ChatMessageUI;
  index: number;
  isFocused: boolean;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
}

export function MessageBubble({
  message,
  prevMessage,
  nextMessage,
  index,
  isFocused,
  onOpenMedia,
}: MessageBubbleProps) {
  const isMe = message.sender === 'me';
  const isSystem =
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;
  const isDeleted = message.isDeleted;
  const isMediaType =
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;

  const showDateSeparator =
    !prevMessage || message.createdAt.slice(0, 10) !== prevMessage.createdAt.slice(0, 10);

  const isSameSender =
    prevMessage &&
    prevMessage.sender === message.sender &&
    prevMessage.name === message.name &&
    prevMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16);

  // 다음 메시지가 같은 발신자 + 같은 분(minute)이면 이 메시지는 그룹의 마지막이 아님
  const isNextSameGroup =
    nextMessage &&
    nextMessage.sender === message.sender &&
    nextMessage.name === message.name &&
    nextMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16) &&
    // 시스템 메시지는 그룹에 포함하지 않음
    nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE &&
    nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;

  const showTime = !isNextSameGroup;

  if (isSystem) {
    return (
      <>
        {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
        <div data-msg-index={index} className="my-2 flex justify-center">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sub-sm text-text-tertiary">
            {message.text}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
      <div
        data-msg-index={index}
        className={cn(
          'flex gap-2 transition-colors',
          isMe ? 'flex-row-reverse' : 'flex-row',
          isSameSender ? 'mt-0.5' : 'mt-3',
          isFocused && 'rounded-lg bg-yellow-100',
        )}
      >
        {!isMe && !isSameSender && (
          <ProfileCircle name={message.name} size="sm" />
        )}
        {!isMe && isSameSender && <div className="w-8 shrink-0" />}

        <div className={cn('flex max-w-[70%] flex-col', isMe ? 'items-end' : 'items-start')}>
          {!isMe && !isSameSender && (
            <span className="mb-1 text-sub-sm font-medium text-text-secondary">{message.name}</span>
          )}
          <div className={cn('flex items-end gap-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
            {isDeleted ? (
              <div className="rounded-xl bg-gray-100 px-3 py-2 text-sub italic text-text-tertiary">
                {IS_DELETE_MESSAGE_COMMENTS}
              </div>
            ) : isMediaType ? (
              renderMessageContent(message, onOpenMedia)
            ) : (
              <div
                className={cn(
                  'rounded-xl px-3 py-2 text-sub',
                  isMe
                    ? 'bg-primary text-on-primary'
                    : 'bg-gray-100 text-text-primary',
                )}
              >
                {renderMessageContent(message, onOpenMedia)}
              </div>
            )}
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {message.notReadCount > 0 && (
                <span className="text-[10px] font-medium text-primary">{message.notReadCount}</span>
              )}
              {showTime && (
                <span className="text-[10px] text-text-tertiary">{message.time}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function renderMessageContent(
  message: ChatMessageUI,
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void,
) {
  if (
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA
  ) {
    if (message.isLocal && message.localUris?.length) {
      const sources = message.localUris.map((uri, idx) => ({
        key: `local-${idx}`,
        src: uri,
      }));
      return (
        <div className="relative">
          <ChatImageGrid sources={sources} dimmed={message.dimmed} />
          <UploadDimOverlay fileId={message.fileId} dimmed={message.dimmed} />
        </div>
      );
    }

    const files = message.files ?? [];
    const sources = files.map((file, idx) => ({
      key: file.path || `file-${idx}`,
      src: file.meta?.thumbnailPresignedUrl || file.presignedUrl || file.path,
      isVideo: file.meta?.type?.startsWith('video/'),
    }));
    const viewerItems: MediaViewerItem[] = files.map((file, idx) => ({
      id: file.path || `${message.id}-${idx}`,
      type: file.meta?.type?.startsWith('video/') ? 'video' as const : 'image' as const,
      url: file.presignedUrl || file.path,
      author: message.name,
    }));

    return (
      <ChatImageGrid
        sources={sources}
        onImageClick={(clickedIndex) => onOpenMedia(viewerItems, clickedIndex)}
      />
    );
  }

  if (message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE) {
    return (
      <div className="flex flex-col gap-1">
        {message.files?.map((file, idx) => (
          <a
            key={idx}
            href={file.presignedUrl || file.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sub underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {file.path.split('/').pop() || '파일'}
          </a>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{message.text}</span>;
}

'use client';

import { useCallback } from 'react';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { TagChip } from '@/shared/ui/TagChip';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import { DateSeparator } from './DateSeparator';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';

interface MessageBubbleProps {
  message: ChatMessageUI;
  prevMessage?: ChatMessageUI;
  nextMessage?: ChatMessageUI;
  index: number;
  isFocused: boolean;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
  onSetNotice?: (text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditTag?: (message: ChatMessageUI) => void;
}

export function MessageBubble({
  message, prevMessage, nextMessage, index, isFocused,
  onOpenMedia, onSetNotice, onDeleteMessage, onEditTag,
}: MessageBubbleProps) {
  const isMe = message.sender === 'me';
  const isSystem = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;
  const isDeleted = message.isDeleted;
  const isMediaType = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;
  const isTextMessage = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT && !isDeleted;
  const hasContextMenu = !isDeleted && !isSystem;
  const hasTags = !isDeleted && (message.tags?.length ?? 0) > 0;

  const showDateSeparator = !prevMessage || message.createdAt.slice(0, 10) !== prevMessage.createdAt.slice(0, 10);
  const isSameSender = prevMessage && prevMessage.sender === message.sender && prevMessage.name === message.name && prevMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16);
  const isNextSameGroup = nextMessage && nextMessage.sender === message.sender && nextMessage.name === message.name && nextMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16) && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;
  const showTime = !isNextSameGroup;

  const showSnackbar = useUIStore(s => s.showSnackbar);
  const currentUserId = useAuthStore(s => s.user?.id);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text);
    showSnackbar({ message: '복사되었습니다.' });
  }, [message.text, showSnackbar]);

  const bubbleStyle = cn('rounded-xl px-3 py-2 text-sub', isMe ? 'bg-primary text-on-primary' : 'bg-gray-100 text-text-primary');

  if (isSystem) {
    return (
      <>
        {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
        <div data-msg-index={index} className="my-2 flex justify-center">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sub-sm text-text-tertiary">{message.text}</span>
        </div>
      </>
    );
  }

  const bubbleContent = (
    <div
      data-msg-index={index}
      className={cn('flex gap-2 transition-colors', isMe ? 'flex-row-reverse' : 'flex-row', isSameSender ? 'mt-1' : 'mt-2', isFocused && 'rounded-lg bg-yellow-100')}
    >
      {!isMe && !isSameSender && (
        <ProfileCircle name={message.name} size="sm" storageKey={message.thumbnailProfileUrl || message.profileImageUrl} />
      )}
      {!isMe && isSameSender && <div className="w-9 shrink-0" />}

      <div className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')} style={{ maxWidth: isMediaType ? 240 : 288 }}>
        {!isMe && !isSameSender && (
          <span className="mb-1 text-sub-sm font-medium text-text-secondary">{message.name}</span>
        )}
        {hasTags && (
          <div className={cn('mb-1 flex flex-wrap gap-1', isMe ? 'justify-end' : 'justify-start')}>
            {message.tags!.map(tag => (
              <TagChip
                key={tag.taggingId ?? tag.tagId}
                label={tag.title}
                variant={String(tag.userId) === String(currentUserId) ? 'mine' : 'others'}
                size="small"
              />
            ))}
          </div>
        )}
        <div className={cn('flex items-end gap-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
          {isDeleted ? (
            <div className={bubbleStyle}>{IS_DELETE_MESSAGE_COMMENTS}</div>
          ) : isMediaType ? (
            <MessageContent message={message} onOpenMedia={onOpenMedia} />
          ) : (
            <div className={bubbleStyle}>
              <MessageContent message={message} onOpenMedia={onOpenMedia} />
            </div>
          )}
          {!isDeleted && (
            <div className={cn('flex shrink-0 flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
              {message.isLocal ? (
                <span className="text-[10px] leading-normal text-primary">
                  <span className="inline-block h-[10px] w-[10px] animate-spin rounded-full border border-primary/30 border-t-primary align-middle" />
                </span>
              ) : (
                message.notReadCount > 0 && <span className="text-[10px] font-medium text-primary">{message.notReadCount}</span>
              )}
              {showTime && <span className="text-[10px] text-text-tertiary">{message.time}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
      <MessageContextMenu
        enabled={hasContextMenu}
        isTextMessage={isTextMessage}
        isMe={isMe}
        onCopy={isTextMessage ? handleCopy : undefined}
        onSetNotice={onSetNotice ? () => onSetNotice(message.text) : undefined}
        onEditTag={() => onEditTag?.(message)}
        onDelete={onDeleteMessage ? () => onDeleteMessage(message.id) : undefined}
      >
        {bubbleContent}
      </MessageContextMenu>
    </>
  );
}

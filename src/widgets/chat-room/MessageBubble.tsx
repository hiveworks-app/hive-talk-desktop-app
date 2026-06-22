'use client';

import { useCallback } from 'react';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { LinkPreviewCard } from '@/shared/ui/LinkPreviewCard';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { TagChip } from '@/shared/ui/TagChip';
import { extractFirstUrl } from '@/shared/utils/linkPreview';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import { DateSeparator } from './DateSeparator';
import { FailedMessageActions } from './FailedMessageActions';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { NoticePill } from './NoticePill';

interface MessageBubbleProps {
  message: ChatMessageUI;
  prevMessage?: ChatMessageUI;
  nextMessage?: ChatMessageUI;
  index: number;
  isFocused: boolean;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
  onSetNotice?: (message: ChatMessageUI) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditTag?: (message: ChatMessageUI) => void;
  onRetryMessage?: (messageId: string) => void;
  onRemoveFailedMessage?: (messageId: string) => void;
  onReportMessage?: (messageId: string) => void;
}

export function MessageBubble({
  message, prevMessage, nextMessage, index, isFocused,
  onOpenMedia, onSetNotice, onDeleteMessage, onEditTag,
  onRetryMessage, onRemoveFailedMessage, onReportMessage,
}: MessageBubbleProps) {
  const isMe = message.sender === 'me';
  const isSystem = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED;
  const isDeleted = message.isDeleted;
  const isMediaType = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;
  const isTextMessage = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT && !isDeleted;
  const firstUrl = isTextMessage ? extractFirstUrl(message.text) : null;
  // 공지 등록 가능: 텍스트 + 단일이미지/미디어/파일 (전송완료된 것만, 묶음 사진 제외 — RN 패리티)
  const canSetNotice = !message.isLocal && !isDeleted && (
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT ||
    (message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE && (message.files?.length ?? 0) === 1) ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE
  );
  const isFailed = message.isLocal && message.localStatus === 'failed';
  const hasContextMenu = !isDeleted && !isSystem && !isFailed;
  const hasTags = !isDeleted && (message.tags?.length ?? 0) > 0;

  const showDateSeparator = !prevMessage || message.createdAt.slice(0, 10) !== prevMessage.createdAt.slice(0, 10);
  const isSameSender = prevMessage && prevMessage.sender === message.sender && prevMessage.name === message.name && prevMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16);
  const isNextSameGroup = nextMessage && nextMessage.sender === message.sender && nextMessage.name === message.name && nextMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16) && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE;
  const showTime = !isNextSameGroup;

  const showSnackbar = useUIStore(s => s.showSnackbar);
  const currentUserId = useAuthStore(s => s.user?.id);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text);
    showSnackbar({ message: '복사되었습니다.' });
  }, [message.text, showSnackbar]);

  // 채팅 말풍선: 내 말풍선=노랑(#FFED66)+진한 글씨, 상대=흰색+진한 글씨. (Figma 1077-15393, chat-bg 위 배치)
  // 글씨는 테마 무관 항상 진한색(gray-900) — 흰/노란 말풍선 가독성 유지.
  const bubbleStyle = cn('rounded-xl px-3 py-2 text-sub', isMe ? 'bg-yellow-300 text-gray-900' : 'bg-white text-gray-900');

  if (isSystem) {
    return (
      <>
        {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
        <NoticePill data-msg-index={index} className="my-2">{message.text}</NoticePill>
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
                isFailed ? (
                  <FailedMessageActions
                    onRetry={() => onRetryMessage?.(message.id)}
                    onDelete={() => onRemoveFailedMessage?.(message.id)}
                  />
                ) : (
                  <span className="text-[10px] leading-normal text-primary">
                    <span className="inline-block h-[10px] w-[10px] animate-spin rounded-full border border-primary/30 border-t-primary align-middle" />
                  </span>
                )
              ) : (
                <>
                  {message.notReadCount > 0 && <span className="text-[10px] font-medium text-primary">{message.notReadCount}</span>}
                  {showTime && <span className="text-[10px] text-text-tertiary">{message.time}</span>}
                </>
              )}
            </div>
          )}
        </div>
        {firstUrl && <LinkPreviewCard url={firstUrl} className="mt-1" />}
      </div>
    </div>
  );

  return (
    <>
      {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
      <MessageContextMenu
        enabled={hasContextMenu}
        isTextMessage={isTextMessage}
        canSetNotice={canSetNotice}
        isMe={isMe}
        onCopy={isTextMessage ? handleCopy : undefined}
        onSetNotice={onSetNotice ? () => onSetNotice(message) : undefined}
        onEditTag={() => onEditTag?.(message)}
        onDelete={onDeleteMessage ? () => onDeleteMessage(message.id) : undefined}
        onReport={!isMe && onReportMessage ? () => onReportMessage(message.id) : undefined}
      >
        {bubbleContent}
      </MessageContextMenu>
    </>
  );
}

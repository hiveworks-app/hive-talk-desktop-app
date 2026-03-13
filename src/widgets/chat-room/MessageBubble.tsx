'use client';

import { useCallback, useMemo } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { useUIStore } from '@/store/uiStore';
import { DateSeparator } from './DateSeparator';
import { MessageContent } from './MessageContent';

/* ── Material Design Filled Icons (16×16) ── */

const IconContentCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const IconCampaign = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
  </svg>
);

const IconNewLabel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12l-4.37 6.16c-.37.52-.98.84-1.63.84H3c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h12c.65 0 1.26.32 1.63.84L21 12z" />
  </svg>
);

const IconDelete = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

/* ── 메뉴 아이템 타입 ── */

interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  state?: 'default' | 'error';
}

/* ── 메뉴 아이템 렌더러 ── */

function ContextMenuItems({ items }: { items: ContextMenuItem[] }) {
  return items.map((item, index) => (
    <div key={item.label}>
      {index > 0 && <div className="border-t border-[#6B7684]" />}
      <ContextMenu.Item
        className={cn(
          'flex cursor-pointer items-center justify-between px-3 py-2 text-sub outline-none hover:bg-white/10',
          item.state === 'error' ? 'text-[#F04452]' : 'text-white',
        )}
        onSelect={item.onSelect}
      >
        {item.label}
        <span className={cn('ml-2 flex h-4 w-4 items-center justify-center', item.state === 'error' ? 'text-[#F04452]' : 'text-white')}>
          {item.icon}
        </span>
      </ContextMenu.Item>
    </div>
  ));
}

/* ── MessageBubble ── */

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
  message,
  prevMessage,
  nextMessage,
  index,
  isFocused,
  onOpenMedia,
  onSetNotice,
  onDeleteMessage,
  onEditTag,
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

  const isNextSameGroup =
    nextMessage &&
    nextMessage.sender === message.sender &&
    nextMessage.name === message.name &&
    nextMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16) &&
    nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE &&
    nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT;

  const showTime = !isNextSameGroup;
  const isTextMessage =
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT && !isDeleted;

  // 컨텍스트 메뉴: 삭제/시스템 메시지 제외
  const hasContextMenu = !isDeleted && !isSystem;

  const showSnackbar = useUIStore(s => s.showSnackbar);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text);
    showSnackbar({ message: '복사되었습니다.' });
  }, [message.text, showSnackbar]);

  const handleDelete = useCallback(() => {
    onDeleteMessage?.(message.id);
  }, [message.id, onDeleteMessage]);

  const handleEditTag = useCallback(() => {
    onEditTag?.(message);
  }, [message, onEditTag]);

  // RN과 동일한 메뉴 구성
  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = [];

    // 복사 - 텍스트 메시지만
    if (isTextMessage) {
      items.push({
        label: '복사',
        icon: <IconContentCopy />,
        onSelect: handleCopy,
      });
    }

    // 공지 등록 - 텍스트 메시지만
    if (isTextMessage && onSetNotice) {
      items.push({
        label: '공지 등록',
        icon: <IconCampaign />,
        onSelect: () => onSetNotice(message.text),
      });
    }

    // 태그 수정 - 모든 메시지
    items.push({
      label: '태그 수정',
      icon: <IconNewLabel />,
      onSelect: handleEditTag,
    });

    // 삭제 - 내 메시지만 (빨간색)
    if (isMe && onDeleteMessage) {
      items.push({
        label: '삭제',
        icon: <IconDelete />,
        state: 'error',
        onSelect: handleDelete,
      });
    }

    return items;
  }, [isTextMessage, isMe, onSetNotice, onDeleteMessage, handleCopy, handleDelete, handleEditTag, message.text]);

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

  const bubbleContent = (
    <div
      data-msg-index={index}
      className={cn(
        'flex gap-2 transition-colors',
        isMe ? 'flex-row-reverse' : 'flex-row',
        isSameSender ? 'mt-1' : 'mt-3',
        isFocused && 'rounded-lg bg-yellow-100',
      )}
    >
      {!isMe && !isSameSender && (
        <ProfileCircle name={message.name} size="sm" storageKey={message.thumbnailProfileUrl || message.profileImageUrl} />
      )}
      {!isMe && isSameSender && <div className="w-9 shrink-0" />}

      <div className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')} style={{ maxWidth: isMediaType ? 240 : 288 }}>
        {!isMe && !isSameSender && (
          <span className="mb-1 text-sub-sm font-medium text-text-secondary">{message.name}</span>
        )}
        <div className={cn('flex items-end gap-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
          {isDeleted ? (
            <div
              className={cn(
                'rounded-xl px-3 py-2 text-sub',
                isMe
                  ? 'bg-primary text-on-primary'
                  : 'bg-gray-100 text-text-primary',
              )}
            >
              {IS_DELETE_MESSAGE_COMMENTS}
            </div>
          ) : isMediaType ? (
            <MessageContent message={message} onOpenMedia={onOpenMedia} />
          ) : (
            <div
              className={cn(
                'rounded-xl px-3 py-2 text-sub',
                isMe
                  ? 'bg-primary text-on-primary'
                  : 'bg-gray-100 text-text-primary',
              )}
            >
              <MessageContent message={message} onOpenMedia={onOpenMedia} />
            </div>
          )}
          {!isDeleted && (
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {message.notReadCount > 0 && (
                <span className="text-[10px] font-medium text-primary">{message.notReadCount}</span>
              )}
              {showTime && (
                <span className="text-[10px] text-text-tertiary">{message.time}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
      {hasContextMenu ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>{bubbleContent}</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="w-[160px] overflow-hidden rounded-xl bg-[#4E5968] shadow-lg animate-in fade-in zoom-in-95">
              <ContextMenuItems items={contextMenuItems} />
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ) : (
        bubbleContent
      )}
    </>
  );
}

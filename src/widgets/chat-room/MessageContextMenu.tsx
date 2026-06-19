'use client';

import { useMemo } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/shared/lib/cn';
import { IconCampaign, IconContentCopy, IconDelete, IconNewLabel, IconReport } from '@/shared/ui/icons';

interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  state?: 'default' | 'error';
}

interface MessageContextMenuProps {
  enabled: boolean;
  children: React.ReactNode;
  isTextMessage: boolean;
  /** 공지 등록 가능 여부 (텍스트 + 단일이미지/미디어/파일) */
  canSetNotice: boolean;
  isMe: boolean;
  onCopy?: () => void;
  onSetNotice?: () => void;
  onEditTag: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export function MessageContextMenu({
  enabled,
  children,
  isTextMessage,
  canSetNotice,
  isMe,
  onCopy,
  onSetNotice,
  onEditTag,
  onDelete,
  onReport,
}: MessageContextMenuProps) {
  const items = useMemo<ContextMenuItem[]>(() => {
    const list: ContextMenuItem[] = [];
    if (isTextMessage && onCopy) list.push({ label: '복사', icon: <IconContentCopy />, onSelect: onCopy });
    if (canSetNotice && onSetNotice) list.push({ label: '공지 등록', icon: <IconCampaign />, onSelect: onSetNotice });
    list.push({ label: '태그 수정', icon: <IconNewLabel />, onSelect: onEditTag });
    if (isMe && onDelete) list.push({ label: '삭제', icon: <IconDelete />, state: 'error', onSelect: onDelete });
    if (!isMe && onReport) list.push({ label: '신고', icon: <IconReport />, onSelect: onReport });
    return list;
  }, [isTextMessage, canSetNotice, isMe, onCopy, onSetNotice, onEditTag, onDelete, onReport]);

  if (!enabled) return <>{children}</>;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="w-[160px] overflow-hidden rounded-xl bg-[#4E5968] shadow-lg animate-in fade-in zoom-in-95">
          {items.map((item, i) => (
            <div key={item.label}>
              {i > 0 && <div className="border-t border-[#6B7684]" />}
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
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

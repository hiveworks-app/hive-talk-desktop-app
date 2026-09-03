'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/shared/lib/cn';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';
import { TAG_ICON_MAP, type TagName } from '@/shared/ui/TagIcon';
import { IconChevronRight } from '@/shared/ui/icons';
import {
  IconOptionCopy,
  IconOptionDelete,
  IconOptionNotice,
  IconRecentWorkTagDefault,
  IconSirenDefault,
} from '@assets/icons';

/** 태그 빠른선택 슬롯 항목 */
export interface QuickTagItem {
  name: string;
  selected: boolean;
  onToggle: () => void;
}

interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  state?: 'default' | 'error' | 'report';
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
  onDelete?: () => void;
  onReport?: () => void;
  /** 태그 빠른선택 슬롯 (5칸) — 미전달 시 태그 카드 미표시 (RN TagSectionCard 패리티) */
  quickTags?: QuickTagItem[];
  /** 태그 카드 우측 '>' — 태그 수정 패널 진입 */
  onMoreTags?: () => void;
}

/** state별 라벨/아이콘 색 (RN OPTION_STATE_COLORS 패리티) — 복사/공지 #191F28, 삭제 #F04452, 신고 #9747FF */
const STATE_COLOR: Record<NonNullable<ContextMenuItem['state']>, string> = {
  default: 'text-gray-900',
  error: 'text-[#F04452]',
  report: 'text-[#9747FF]',
};

/**
 * 메시지 우클릭 메뉴 — 포인터가 아닌 "말풍선 기준" 아래/위 배치 (RN ContextMenu 패리티).
 * 포인터 기준 좌/우 배치(Radix ContextMenu)는 좁은 창에서 양쪽 공간이 모두 부족하면
 * 수평 클램핑 없이 화면 밖으로 잘리므로, Popover 앵커 + side=bottom으로 전환해
 * 가로는 자동 클램핑·세로는 위/아래 flip만 일어나게 한다.
 * 정렬: 내 메시지=행 우측(end), 상대=행 좌측(start) — RN 수평 배치 규칙과 동일.
 */
export function MessageContextMenu({
  enabled,
  children,
  isTextMessage,
  canSetNotice,
  isMe,
  onCopy,
  onSetNotice,
  onDelete,
  onReport,
  quickTags,
  onMoreTags,
}: MessageContextMenuProps) {
  const [open, setOpen] = useState(false);
  // ESC=메뉴 닫기만 — 억제 없으면 Radix가 닫는 순간 메인이 창을 트레이로 숨긴다 (2026-09-03)
  useEscSuppress(open);

  const items = useMemo<ContextMenuItem[]>(() => {
    const list: ContextMenuItem[] = [];
    if (isTextMessage && onCopy) list.push({ label: '복사', icon: <IconOptionCopy width={20} height={20} />, onSelect: onCopy });
    if (canSetNotice && onSetNotice) list.push({ label: '공지 등록', icon: <IconOptionNotice width={20} height={20} />, onSelect: onSetNotice });
    if (isMe && onDelete) list.push({ label: '삭제', icon: <IconOptionDelete width={20} height={20} />, state: 'error', onSelect: onDelete });
    if (!isMe && onReport) list.push({ label: '신고', icon: <IconSirenDefault width={20} height={20} />, state: 'report', onSelect: onReport });
    return list;
  }, [isTextMessage, canSetNotice, isMe, onCopy, onSetNotice, onDelete, onReport]);

  const hasMenu = enabled && (items.length > 0 || !!quickTags?.length);

  /** 메뉴 닫은 뒤 액션 실행 — RN "메뉴 닫힘 → 액션" 순서 유지 */
  const runAndClose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div
          onContextMenu={e => {
            if (!hasMenu) return;
            e.preventDefault();
            setOpen(true);
          }}
        >
          {children}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align={isMe ? 'end' : 'start'}
          sideOffset={4}
          collisionPadding={12}
          onOpenAutoFocus={e => e.preventDefault()}
          className="z-[60] w-[240px] max-w-[calc(100vw-24px)] outline-none animate-in fade-in zoom-in-95"
        >
          {/* 태그 빠른선택 카드 — 옵션 카드 위 (RN TagSectionCard 패리티) */}
          {!!quickTags?.length && (
            <div className="mb-1 w-full rounded-xl bg-white px-3 py-2.5 shadow-[0px_2px_15px_rgba(0,0,0,0.15)]">
              <div className="mb-2 flex min-w-0 items-center gap-1.5">
                <IconRecentWorkTagDefault width={12} height={10} className="shrink-0 text-gray-700" />
                <span className="truncate whitespace-nowrap text-[12px] font-medium leading-4 text-gray-900">중요메시지에 업무태그를 달아보세요</span>
              </div>
              <div className="flex items-center justify-between">
                {quickTags.map(tag => {
                  const SvgIcon = TAG_ICON_MAP[tag.name as TagName] ?? null;
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => runAndClose(tag.onToggle)}
                      aria-label={`${tag.name} 태그 ${tag.selected ? '해제' : '부착'}`}
                      aria-pressed={tag.selected}
                      className={cn(
                        'flex size-7 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors',
                        tag.selected
                          ? 'border-[1.5px] border-blue-500 bg-[#E6F3FF]'
                          : 'bg-gray-100 hover:bg-gray-200',
                      )}
                    >
                      {SvgIcon && <SvgIcon width={16} height={16} />}
                    </button>
                  );
                })}
                {onMoreTags && (
                  <button
                    type="button"
                    onClick={() => runAndClose(onMoreTags)}
                    aria-label="태그 더보기"
                    className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-gray-100 outline-none transition-colors hover:bg-gray-200"
                  >
                    <IconChevronRight size={12} className="text-gray-700" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 옵션 카드 — 흰 배경, 라벨 왼쪽 + 아이콘 오른쪽 (RN OptionSectionCard 패리티) */}
          {items.length > 0 && (
            <div className="w-full overflow-hidden rounded-xl bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)]">
              {items.map((item, i) => {
                const color = STATE_COLOR[item.state ?? 'default'];
                return (
                  <div key={item.label}>
                    {i > 0 && <div className="border-t border-gray-200" />}
                    <button
                      type="button"
                      onClick={() => runAndClose(item.onSelect)}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-sub outline-none hover:bg-gray-100',
                        color,
                      )}
                    >
                      {item.label}
                      <span className={cn('ml-2 flex h-[18px] w-[18px] items-center justify-center', color)}>
                        {item.icon}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

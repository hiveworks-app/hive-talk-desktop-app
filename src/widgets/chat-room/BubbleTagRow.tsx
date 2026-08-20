'use client';

import { memo } from 'react';
import { cn } from '@/shared/lib/cn';
import type { TagListType } from '@/shared/types/tag';
import { TAG_ICON_MAP, type TagName } from '@/shared/ui/TagIcon';

interface BubbleTagRowProps {
  tags: TagListType[];
  /** 클릭 시 업무태그 수정(UPDATE) 시트 오픈. 미지정 시 비클릭 표시 전용. */
  onClick?: () => void;
  className?: string;
}

/** 칩 크기 24px / 내부 아이콘 18px (Figma node I1228:25011;1228:24924) */
const CHIP_SIZE = 24;
const ICON_SIZE = 18;

/**
 * 말풍선 아래 아이콘 전용 업무태그 칩 행 (RN BubbleTagRow 미러).
 *
 * 24px 흰 칩 + 18px 다색 SVG 아이콘. 좌/우 정렬은 부모(items-start/end)가 결정하므로
 * 행 자체는 콘텐츠 폭으로 둔다. 클릭 시 태그 편집 시트를 UPDATE 모드로 다시 연다
 * (정책 chat-room.md: "메세지 아래 태그 아이콘 클릭 → 바텀시트 재오픈 수정").
 */
function BubbleTagRowComponent({ tags, onClick, className }: BubbleTagRowProps) {
  if (!tags?.length) return null;

  const chips = (
    <div className="flex items-center gap-0.5">
      {tags.map((tag, index) => {
        const SvgIcon = TAG_ICON_MAP[tag.title as TagName] ?? null;
        return (
          <span
            key={tag.taggingId ?? `${tag.tagId}-${index}`}
            className="flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#FAFAFA]"
            style={{ width: CHIP_SIZE, height: CHIP_SIZE }}
          >
            {SvgIcon && <SvgIcon width={ICON_SIZE} height={ICON_SIZE} />}
          </span>
        );
      })}
    </div>
  );

  if (!onClick) return <div className={className}>{chips}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="업무태그 수정"
      className={cn('cursor-pointer', className)}
    >
      {chips}
    </button>
  );
}

export const BubbleTagRow = memo(BubbleTagRowComponent);

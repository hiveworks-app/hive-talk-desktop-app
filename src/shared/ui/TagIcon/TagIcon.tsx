'use client';

import { memo } from 'react';
import { cn } from '@/shared/lib/cn';
import { IconNewLabel } from '@/shared/ui/icons';
import { TAG_ICON_MAP } from './tagIconMap';
import type { TagIconProps, TagName } from './type';

const DEFAULT_SIZE = 56;
const ICON_SIZE = 24;

/**
 * 업무태그 아이콘 (아이콘 + 라벨, 정사각형 칩).
 *
 * 태그 SVG 는 다색 고정(예: #007AFF/#F04452/흰색)이라 선택 상태로 아이콘 색을
 * 바꾸지 않는다. 대신 컨테이너 배경(gray-100 ↔ blue-100)·테두리·라벨 색만 변경한다.
 * 칩 배경을 고정 라이트 톤으로 두어 다크모드에서도 다색 아이콘 가독성을 보장.
 *
 * 비선택 시에도 border-2 border-transparent 를 유지해 선택 시 2px 테두리로 인한
 * 레이아웃 점프(꿈틀거림)를 방지한다.
 */
function TagIconComponent({
  name,
  selected = false,
  disabled = false,
  onClick,
  size = DEFAULT_SIZE,
}: TagIconProps) {
  const SvgIcon = TAG_ICON_MAP[name as TagName] ?? null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 transition-colors',
        selected ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-gray-100',
        disabled ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      {SvgIcon ? (
        <SvgIcon width={ICON_SIZE} height={ICON_SIZE} />
      ) : (
        <IconNewLabel size={ICON_SIZE} className={selected ? 'text-blue-500' : 'text-gray-800'} />
      )}
      <span
        className={cn(
          'max-w-full truncate text-[11px] font-semibold leading-[14px] tracking-[-0.1px]',
          selected ? 'text-blue-500' : 'text-gray-800',
        )}
      >
        {name}
      </span>
    </button>
  );
}

export const TagIcon = memo(TagIconComponent);

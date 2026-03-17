'use client';

import { memo } from 'react';
import { clsx } from 'clsx';
import { IconCheck, IconCloseFilled } from '@/shared/ui/icons';

export type TagChipVariant = 'mine' | 'others';

interface TagChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  variant?: TagChipVariant;
  icon?: 'check' | 'close';
  onClick?: () => void;
  size?: 'small' | 'large';
}

/* ── Variant 색상 정의 ── */

const VARIANT_STYLES = {
  mine: {
    text: 'text-[#007AFF]',
    border: 'border-[#007AFF]',
    bg: 'bg-[#E6F3FF]',
  },
  others: {
    text: 'text-[#B45309]',
    border: 'border-[#F59E0B]',
    bg: 'bg-[#FFFBEB]',
  },
} as const;

function TagChipComponent({
  label,
  selected = false,
  disabled = false,
  variant,
  icon,
  onClick,
  size = 'large',
}: TagChipProps) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 10 : 14;

  // variant가 있으면 variant 색상 우선
  const styles = (() => {
    if (variant) return VARIANT_STYLES[variant];
    if (disabled) return { text: 'text-text-placeholder', border: 'border-outline', bg: 'bg-surface-pressed' };
    if (selected) return { text: 'text-white', border: 'border-[#007AFF]', bg: 'bg-[#007AFF]' };
    return { text: 'text-text-primary', border: 'border-outline', bg: 'bg-white' };
  })();

  const content = (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border',
        isSmall ? 'px-2 py-px text-[11px]' : 'px-2.5 py-0.5 text-sub',
        styles.border,
        styles.bg,
        styles.text,
      )}
    >
      {label}
      {icon === 'check' && <IconCheck size={iconSize} />}
      {icon === 'close' && <IconCloseFilled size={iconSize} />}
    </span>
  );

  if (disabled || !onClick) return content;

  return (
    <button type="button" onClick={onClick} className="cursor-pointer">
      {content}
    </button>
  );
}

export const TagChip = memo(TagChipComponent);

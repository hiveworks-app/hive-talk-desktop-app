'use client';

import { cn } from '@/shared/lib/cn';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Figma 패리티: 16px / line-height 22px / tracking -0.16px, 세로패딩 7px (3개 칩 동일)
        'rounded-full px-3 py-[7px] text-[16px] font-medium leading-[22px] tracking-[-0.16px] transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-gray-100 text-text-secondary hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}

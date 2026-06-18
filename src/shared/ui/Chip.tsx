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
        // 타이포: text-body 토큰(16px) + 세로패딩 7px (3개 칩 동일)
        'rounded-full px-3 py-[7px] text-body font-medium transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-gray-100 text-text-secondary hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}

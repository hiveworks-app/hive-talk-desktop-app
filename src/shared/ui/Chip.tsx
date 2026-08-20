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
        // RN Chip lg 패리티: py-7px + 3자 이하 라벨은 px-4('전체' 등 짧은 칩이 좁아 보이지 않게)
        'rounded-full py-[7px] text-body font-medium transition-colors',
        label.length <= 3 ? 'px-4' : 'px-3',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-gray-50 text-text-secondary hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}

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
        'rounded-full px-3 py-1 text-sub-sm font-medium transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-gray-100 text-text-secondary hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}

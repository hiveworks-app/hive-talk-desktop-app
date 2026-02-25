import { cn } from '@/shared/lib/cn';

interface BadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function Badge({ count, max = 99, className }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full bg-state-error px-1 text-[10px] font-bold text-on-primary',
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

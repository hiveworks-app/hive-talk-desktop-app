import { cn } from '@/shared/lib/cn';

type ProfileCircleSize = 'sm' | 'md' | 'lg';

interface ProfileCircleProps {
  name: string;
  size?: ProfileCircleSize;
  className?: string;
}

const sizeStyles: Record<ProfileCircleSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-[var(--size-avatar)] w-[var(--size-avatar)] text-sm',
  lg: 'h-12 w-12 text-base',
};

export function ProfileCircle({ name, size = 'sm', className }: ProfileCircleProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-text-secondary',
        sizeStyles[size],
        className,
      )}
    >
      {name.charAt(0)}
    </div>
  );
}

import { cn } from '@/shared/lib/cn';

type CheckboxSize = 'md' | 'lg';

interface CheckboxProps {
  checked: boolean;
  size?: CheckboxSize;
  className?: string;
}

const sizeStyles: Record<CheckboxSize, { container: string; iconSize: number }> = {
  lg: { container: 'h-6 w-6', iconSize: 16 },
  md: { container: 'h-5 w-5', iconSize: 12 },
};

export function Checkbox({ checked, size = 'lg', className }: CheckboxProps) {
  const { container, iconSize } = sizeStyles[size];

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded border-2 transition-colors',
        container,
        checked ? 'border-primary bg-primary' : 'border-gray-300',
        className,
      )}
    >
      {checked && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

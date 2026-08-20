import { cn } from '@/shared/lib/cn';

type CheckboxSize = 'md' | 'lg';

interface CheckboxProps {
  checked: boolean;
  size?: CheckboxSize;
  disabled?: boolean;
  className?: string;
}

/* 데스크톱 크기 — lg 20px(체크 13×9), md 16px(체크 10×7). (RN 터치 기준 24/20에서 축소, rounded-md + 1px 보더 유지) */
const sizeStyles: Record<CheckboxSize, { container: string; iconWidth: number; iconHeight: number }> = {
  lg: { container: 'h-5 w-5', iconWidth: 13, iconHeight: 9 },
  md: { container: 'h-4 w-4', iconWidth: 10, iconHeight: 7 },
};

export function Checkbox({ checked, size = 'lg', disabled = false, className }: CheckboxProps) {
  const { container, iconWidth, iconHeight } = sizeStyles[size];
  const showIcon = disabled || checked;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border transition-colors',
        container,
        disabled
          ? 'border-transparent bg-gray-200'
          : checked
            ? 'border-transparent bg-primary'
            : 'border-gray-300 bg-white',
        className,
      )}
    >
      {showIcon && (
        <svg
          width={iconWidth}
          height={iconHeight}
          viewBox="0 0 16 11"
          fill="none"
          stroke={disabled ? '#ADB5BD' : 'white'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="1 5.5 6 10 15 1" />
        </svg>
      )}
    </div>
  );
}

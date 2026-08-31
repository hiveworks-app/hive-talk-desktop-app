import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

type InputHeight = 'sm' | 'md' | 'lg';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /** 데스크톱 높이 체계 — sm 32 / md 36 / lg 40(기본). (RN 터치 기준 40/48/56에서 축소) */
  inputSize?: InputHeight;
}

// 중간 스케일 (2026-08-31 사용자 확정) — Button과 동일한 48/40/36 체계 (RN과 구 데스크톱의 중간)
const sizeStyles: Record<InputHeight, string> = {
  sm: 'h-9 text-sub',
  md: 'h-10 text-body',
  lg: 'h-12 text-body',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, inputSize = 'lg', ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-[10px] border bg-surface px-4 text-text-primary outline-none placeholder:text-text-placeholder transition disabled:bg-disabled disabled:text-text-disabled disabled:border-outline disabled:cursor-not-allowed',
        sizeStyles[inputSize],
        error
          ? 'border-state-error ring-1 ring-inset ring-state-error'
          : 'border-outline focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

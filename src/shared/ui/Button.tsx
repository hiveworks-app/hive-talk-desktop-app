import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dark'
  | 'primary-light'
  | 'outlined'
  | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * RN Button 패리티 매핑 (RN shared/ui/Button/Button.tsx):
 * primary=fill/primary, secondary=filled-contrast/dark, dark=fill/dark, danger=fill/danger,
 * primary-light=filled-contrast/primary, outlined=outlined/primary, warning=fill/warning.
 * pressed 색은 hover(데스크톱 어포던스)와 active 양쪽에 적용.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-[var(--color-state-primary-pressed)] active:bg-[var(--color-state-primary-pressed)] disabled:bg-blue-300 disabled:text-white',
  secondary:
    'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400',
  ghost:
    'text-primary hover:opacity-80 active:text-blue-300 disabled:text-gray-500',
  dark:
    'bg-gray-700 text-white hover:bg-gray-800 active:bg-gray-800 disabled:bg-gray-400 disabled:text-white',
  danger:
    'bg-state-error text-on-primary hover:bg-state-error-pressed active:bg-state-error-pressed disabled:opacity-50',
  'primary-light':
    'bg-blue-100 text-primary hover:bg-blue-300 active:bg-blue-300 disabled:bg-blue-100 disabled:text-blue-300',
  outlined:
    'border border-primary text-primary bg-transparent hover:border-blue-300 hover:text-blue-300 active:border-blue-300 active:text-blue-300 disabled:border-gray-200 disabled:text-gray-500',
  warning:
    'bg-yellow-300 text-gray-900 hover:bg-yellow active:bg-yellow disabled:bg-gray-400 disabled:text-white',
};

/* 중간 스케일 (2026-08-31 사용자 확정): RN(56/48/40)과 구 데스크톱(40/36/32)의 중간.
 * lg 48px(주요 CTA)/md 40px(다이얼로그 버튼)/sm 36px(보조).
 * RN 동일 56px로 갔다가 "데스크톱에선 너무 크다"로 한 단계 하향 — 텍스트는 데스크톱 타이포 유지 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sub rounded-md',
  md: 'h-10 px-4 text-body rounded-lg',
  lg: 'h-12 px-5 text-body rounded-[10px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

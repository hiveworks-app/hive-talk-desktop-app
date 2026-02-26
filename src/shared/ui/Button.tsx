import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled disabled:text-text-placeholder',
  secondary:
    'bg-gray-100 text-text-primary hover:bg-gray-200 disabled:opacity-50',
  ghost:
    'text-text-secondary hover:bg-gray-100 disabled:opacity-50',
  danger:
    'bg-state-error text-on-primary hover:opacity-90 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sub-sm rounded-md',
  md: 'h-[var(--size-touch-target)] px-4 text-sub rounded-lg',
  lg: 'h-12 px-6 text-heading-sm rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors',
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

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-[var(--size-touch-target)] w-full rounded-lg border bg-surface px-3 text-sub text-text-primary outline-none placeholder:text-text-placeholder transition-colors',
        error
          ? 'border-state-error focus:border-state-error'
          : 'border-outline focus:border-primary',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

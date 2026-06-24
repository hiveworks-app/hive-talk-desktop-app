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
        'h-[var(--size-touch-target)] w-full rounded-lg border bg-surface px-3 text-sub text-text-primary outline-none placeholder:text-text-placeholder transition disabled:bg-disabled disabled:text-text-disabled disabled:border-outline disabled:cursor-not-allowed',
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

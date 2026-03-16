'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { IconClearCircle, IconEyeClosed, IconEyeOpen } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/Input';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function PasswordField({
  value,
  onChange,
  placeholder = '비밀번호',
  error,
  disabled,
  className,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          error={!!error}
          disabled={disabled}
          className={cn('h-11', value.length > 0 && (focused ? 'pr-16' : 'pr-10'), className)}
        />
        {value.length > 0 && (
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {focused && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={preventBlur}
                onClick={() => onChange('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <IconClearCircle />
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={preventBlur}
              onClick={() => setShow(prev => !prev)}
              className="text-gray-400 hover:text-gray-600"
            >
              {show ? <IconEyeOpen /> : <IconEyeClosed />}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sub-sm text-state-error">{error}</p>}
    </div>
  );
}

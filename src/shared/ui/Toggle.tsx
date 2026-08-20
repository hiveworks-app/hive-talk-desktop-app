'use client';

import { cn } from '@/shared/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * 토글 스위치 — 데스크톱 크기 40×24, thumb 20px (RN 터치 기준 52×31에서 축소).
 * ON = Yellow 500(#FFD900) / OFF = gray-400(#ADB5BD) — 색은 RN Switch accent 패리티.
 */
export function Toggle({ checked, onChange, disabled = false, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-yellow' : 'bg-gray-400',
        disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

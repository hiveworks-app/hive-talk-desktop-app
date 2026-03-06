import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-heading-xl',
        'text-heading-lg',
        'text-heading-md',
        'text-heading-sm',
        'text-label',
        'text-body-lg',
        'text-body',
        'text-sub',
        'text-sub-sm',
        'text-caption',
        'text-caption-sm',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

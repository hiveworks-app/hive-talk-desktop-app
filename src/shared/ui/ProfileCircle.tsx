'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';

type ProfileCircleSize = 'sm' | 'md' | 'lg';

interface ProfileCircleProps {
  name: string;
  size?: ProfileCircleSize;
  storageKey?: string | null;
  className?: string;
}

const sizeStyles: Record<ProfileCircleSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-[var(--size-avatar)] w-[var(--size-avatar)]',
  lg: 'h-11 w-11',
};

const noImagePadding: Record<ProfileCircleSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2',
};

export function ProfileCircle({ name, size = 'sm', storageKey, className }: ProfileCircleProps) {
  const { data: presignedUrl, refetch } = usePresignedUrl(storageKey);
  const [isBroken, setIsBroken] = useState(false);
  const retryCountRef = useRef(0);

  const handleImageError = useCallback(() => {
    if (retryCountRef.current < 2) {
      retryCountRef.current += 1;
      refetch();
    } else {
      setIsBroken(true);
    }
  }, [refetch]);

  const hasImage = !!presignedUrl && !isBroken;

  if (hasImage) {
    return (
      <img
        src={presignedUrl}
        alt={name}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizeStyles[size],
          className,
        )}
        onError={handleImageError}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-blue-100',
        sizeStyles[size],
        noImagePadding[size],
        className,
      )}
    >
      <img
        src="/empty-profile.png"
        alt={name}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useOgPreview } from '@/shared/hooks/useOgPreview';
import { cn } from '@/shared/lib/cn';
import { extractFallbackTitle, getDomain, normalizeUrl } from '@/shared/utils/linkPreview';

interface LinkPreviewCardProps {
  url: string;
  className?: string;
}

/** 메시지 내 첫 URL의 OG 미리보기 카드. 클릭 시 외부 브라우저로 링크 열기. */
export function LinkPreviewCard({ url, className }: LinkPreviewCardProps) {
  const { data, isLoading } = useOgPreview(url);
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!data) return null;

  // 🦴 fetch 진행 중 — 실제 카드와 동일 구조의 skeleton으로 레이아웃 점프 방지
  if (isLoading) {
    return (
      <div className={cn('w-[248px] max-w-full overflow-hidden rounded-xl border border-divider bg-surface', className)}>
        <div className="h-36 w-full bg-gray-100" />
        <div className="flex flex-col gap-1 p-2.5">
          <div className="h-3.5 w-full rounded bg-gray-100" />
          <div className="h-3.5 w-2/3 rounded bg-gray-100" />
          <div className="h-3 w-1/3 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  const { title, description, domain, thumbnailUrl } = data;
  const displayTitle = title || extractFallbackTitle(url);
  const displayDomain = domain || getDomain(url);
  const hasThumbnail = Boolean(thumbnailUrl) && !thumbFailed;

  return (
    <a
      href={normalizeUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block w-[248px] max-w-full overflow-hidden rounded-xl border border-divider bg-surface transition-colors hover:bg-gray-50',
        className,
      )}
    >
      {hasThumbnail && (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-36 w-full bg-gray-100 object-cover"
          onError={() => setThumbFailed(true)}
        />
      )}
      <div className="flex flex-col gap-1 p-2.5">
        <span className="line-clamp-2 text-body font-semibold text-text-primary">{displayTitle}</span>
        {description && (
          <span className="line-clamp-1 text-sub-sm text-text-secondary">{description}</span>
        )}
        <span className="line-clamp-1 text-sub-sm text-primary">{displayDomain}</span>
      </div>
    </a>
  );
}

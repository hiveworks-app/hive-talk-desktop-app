'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LinkPreviewData } from '@/shared/utils/linkPreview';

/** URL별 OG 데이터 인메모리 캐시 (앱 실행 중 유지) — RN useOgPreview 미러 */
const ogCache = new Map<string, LinkPreviewData>();

async function fetchOgPreview(url: string): Promise<LinkPreviewData> {
  try {
    const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { url, domain: undefined };
    return (await res.json()) as LinkPreviewData;
  } catch {
    return { url, domain: undefined };
  }
}

function shouldCachePreview(result: LinkPreviewData): boolean {
  return Boolean(result.title || result.description || result.thumbnailUrl);
}

export interface OgPreviewState {
  /** OG 미리보기 데이터 (url 있으면 항상 존재, fallback으로 url/domain 포함) */
  data: LinkPreviewData | null;
  /** fetch가 아직 완료되지 않았는지 여부 (캐시에 있으면 false) */
  isLoading: boolean;
}

/** URL의 OG 메타데이터를 서버 route로 fetch하여 LinkPreviewData로 반환 */
export function useOgPreview(url: string | null): OgPreviewState {
  const [fetchedData, setFetchedData] = useState<LinkPreviewData | null>(null);
  const isMountedRef = useRef(true);

  // 캐시 또는 fallback 값 (렌더 시 동기적으로 계산)
  const cachedOrFallback = useMemo(() => {
    if (!url) return null;
    return ogCache.get(url) ?? { url, domain: undefined };
  }, [url]);

  const handleFetchComplete = useCallback((result: LinkPreviewData) => {
    if (!isMountedRef.current) return;
    if (shouldCachePreview(result)) ogCache.set(result.url, result);
    setFetchedData(result);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!url || ogCache.has(url)) return;

    fetchOgPreview(url).then(handleFetchComplete);

    return () => {
      isMountedRef.current = false;
    };
  }, [url, handleFetchComplete]);

  if (!url) return { data: null, isLoading: false };

  const isCached = ogCache.has(url);
  const isFetched = Boolean(fetchedData && fetchedData.url === url);
  const isLoading = !isCached && !isFetched;

  if (fetchedData && fetchedData.url === url) {
    return { data: fetchedData, isLoading: false };
  }
  return { data: cachedOrFallback, isLoading };
}

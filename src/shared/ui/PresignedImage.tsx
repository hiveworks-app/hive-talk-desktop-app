'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGetStorage } from '@/features/storage/api';
import { PRESIGNED_URL } from '@/shared/config/queryKeys';

interface PresignedImageProps {
  /** NCP 스토리지 키 — 내장 URL 만료 시 fresh presigned 재발급용 */
  storageKey?: string | null;
  /** 목록/메시지에 내장돼 온 presigned URL — 있으면 우선 사용(추가 요청 0) */
  fallbackUrl?: string | null;
  alt?: string;
  className?: string;
}

/**
 * 만료 자동 복구 이미지 (RN useGetObjectStorageWithCache 소비처 대응).
 * 내장 presigned URL을 우선 쓰고, 로드 실패(만료 403 등) 시에만 키로 fresh URL을
 * 재발급해 최대 2회 재시도한다 — RN처럼 전 썸네일을 재발급하면 요청이 폭주하므로
 * lazy 재발급으로 개선. 내장 URL이 아예 없으면 즉시 발급한다.
 */
export function PresignedImage({ storageKey, fallbackUrl, alt = '', className }: PresignedImageProps) {
  const retryRef = useRef(0);
  const [useFresh, setUseFresh] = useState(!fallbackUrl);

  const { data: freshUrl, refetch } = useQuery({
    queryKey: PRESIGNED_URL(storageKey ?? ''),
    enabled: !!storageKey && useFresh,
    queryFn: async () => {
      if (!storageKey) return null;
      const res = await apiGetStorage(storageKey);
      return res.payload.key as string;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const src = (useFresh && freshUrl) || fallbackUrl || freshUrl;
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (!storageKey || retryRef.current >= 2) return;
        retryRef.current += 1;
        if (!useFresh) setUseFresh(true);
        else void refetch();
      }}
    />
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { PRESIGNED_URL } from '@/shared/config/queryKeys';
import { apiGetStorage } from './api';

export const usePresignedUrl = (key: string | null | undefined) => {
  return useQuery({
    queryKey: PRESIGNED_URL(key ?? ''),
    enabled: !!key,
    queryFn: async () => {
      if (!key) return null;
      const res = await apiGetStorage(key);
      return res.payload.key as string;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};

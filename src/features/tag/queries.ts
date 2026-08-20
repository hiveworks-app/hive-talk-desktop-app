'use client';

import { useCallback } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiGetTagCategoryList, apiGetTagList } from '@/features/tag/api';
import { TAG_CATEGORY_KEY, TAG_LIST_KEY } from '@/shared/config/queryKeys';

export const useGetTagCategoryList = () => {
  return useQuery({ queryKey: [TAG_CATEGORY_KEY], queryFn: apiGetTagCategoryList });
};

export const useGetTagList = () => {
  return useQuery({ queryKey: [TAG_LIST_KEY], queryFn: apiGetTagList });
};

export const useGetTagInfo = () => {
  const results = useQueries({
    queries: [
      {
        queryKey: [TAG_CATEGORY_KEY],
        queryFn: async () => {
          const res = await apiGetTagCategoryList();
          return res.payload.items;
        },
        staleTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: [TAG_LIST_KEY],
        queryFn: async () => {
          const res = await apiGetTagList();
          return res.payload.items;
        },
        staleTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
      },
    ],
  });

  const [tagCategoryQuery, tagListQuery] = results;

  const isLoading =
    tagCategoryQuery.isPending ||
    tagListQuery.isPending ||
    tagCategoryQuery.isLoading ||
    tagListQuery.isLoading;

  const error = tagCategoryQuery.error || tagListQuery.error;
  // effect deps에 들어갈 수 있는 함수 — 렌더마다 재생성되면 쿼리 상태 전이 리렌더 →
  // effect 재발화 → refetch 무한 루프가 된다 (v5 refetch는 stable ref, RN 커밋 531fec5f 교훈)
  const { refetch: refetchTagCategory } = tagCategoryQuery;
  const { refetch: refetchTagList } = tagListQuery;
  const refetchAll = useCallback(async () => {
    const [tagCategory, tagList] = await Promise.all([
      refetchTagCategory(),
      refetchTagList(),
    ]);
    return { tagCategory: tagCategory.data, tagList: tagList.data };
  }, [refetchTagCategory, refetchTagList]);

  return {
    tagCategory: tagCategoryQuery.data,
    tagList: tagListQuery.data,
    isLoading,
    error,
    refetchAll,
  };
};

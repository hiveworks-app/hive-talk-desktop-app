'use client';

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
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: [TAG_LIST_KEY],
        queryFn: async () => {
          const res = await apiGetTagList();
          return res.payload.items;
        },
        staleTime: 5 * 60 * 1000,
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
  const refetchAll = async () => {
    const [tagCategory, tagList] = await Promise.all([
      tagCategoryQuery.refetch(),
      tagListQuery.refetch(),
    ]);
    return { tagCategory: tagCategory.data, tagList: tagList.data };
  };

  return {
    tagCategory: tagCategoryQuery.data,
    tagList: tagListQuery.data,
    isLoading,
    error,
    refetchAll,
  };
};

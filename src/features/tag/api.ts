import { request } from '@/shared/api';
import { TagCategoryListGetPayload, TagListGetPayload } from './type';

export const apiGetTagCategoryList = () => {
  return request<TagCategoryListGetPayload>('/app/tags/categories', {
    method: 'GET',
  });
};

export const apiGetTagList = () => {
  // RN과 동일 파라미터 — 업무태그(COMPANY_ISSUE) 카테고리만 조회해 시트 노출 집합 정합 (RN 패리티)
  return request<TagListGetPayload>('/app/tags?categoryCode=COMPANY_ISSUE', {
    method: 'GET',
  });
};

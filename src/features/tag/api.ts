import { request } from '@/shared/api';
import { TagCategoryListGetPayload, TagListGetPayload } from './type';

export const apiGetTagCategoryList = () => {
  return request<TagCategoryListGetPayload>('/app/tags/categories', {
    method: 'GET',
  });
};

export const apiGetTagList = () => {
  return request<TagListGetPayload>('/app/tags?page=1&size=1000&sort=tagCode%2CASC', {
    method: 'GET',
  });
};

import { request } from '@/shared/api';

interface GetStorageResponse {
  key: string;
}

export const apiGetStorage = (key: string) =>
  request<GetStorageResponse>('/app/storage', {
    method: 'PUT',
    body: { key },
  });

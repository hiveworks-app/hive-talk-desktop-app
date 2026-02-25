import { request } from '@/shared/api';
import {
  MyProfileImageUpdateRequestProps,
  MyProfileImageUpdateResponsePayload,
  MyProfileUpdateRequestProps,
  MyProfileUpdateResponsePayload,
} from '@/features/profile/type';

export const apiUpdateMyProfile = (data: MyProfileUpdateRequestProps) =>
  request<MyProfileUpdateResponsePayload>('/app/profiles', {
    method: 'PUT',
    body: data,
  });

export const apiUpdateMyProfileImage = (data: MyProfileImageUpdateRequestProps) =>
  request<MyProfileImageUpdateResponsePayload>(`/app/profiles/file-upload/${data.fileName}`, {
    method: 'POST',
    body: data,
  });

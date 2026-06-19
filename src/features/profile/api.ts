import { request } from '@/shared/api';
import {
  CredentialInfoResponsePayload,
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

/** 내 credential 인증/변경 시점 조회 (이메일/비밀번호/휴대폰) */
export const apiGetCredentialInfo = () =>
  request<CredentialInfoResponsePayload>('/app/profiles/credential-info', { method: 'GET' });

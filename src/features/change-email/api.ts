import { request } from '@/shared/api';
import type {
  ChangeEmailRequestProps,
  ChangeEmailVerificationRequestProps,
  ChangeEmailVerifyRequestProps,
} from './type';

/** 변경할 새 이메일로 인증 코드 발송 */
export const apiChangeEmailVerification = (data: ChangeEmailVerificationRequestProps) =>
  request<string>('/app/profiles/emails/verifications', {
    method: 'PUT',
    body: data,
  });

/** 이메일 인증 코드 검증 */
export const apiChangeEmailVerify = (data: ChangeEmailVerifyRequestProps) =>
  request<string>('/app/profiles/emails/verifications/verify', {
    method: 'PUT',
    body: data,
  });

/** 이메일 최종 변경 */
export const apiChangeEmail = (data: ChangeEmailRequestProps) =>
  request<string>('/app/profiles/emails', {
    method: 'PUT',
    body: data,
  });

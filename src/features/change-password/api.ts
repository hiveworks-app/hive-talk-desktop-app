import { request } from '@/shared/api';
import type {
  ChangePasswordRequestProps,
  EmailVerificationCheckerRequestProps,
} from './type';

/** 이메일 인증 코드 발송 (로그인 상태) */
export const apiEmailVerifications = () =>
  request<string>('/app/profiles/passwords/email-verifications', {
    method: 'PUT',
  });

/** 이메일 인증 코드 확인 */
export const apiEmailVerificationChecker = (data: EmailVerificationCheckerRequestProps) =>
  request<string>('/app/profiles/passwords/email-verifications/verify', {
    method: 'PUT',
    body: data,
  });

/** 비밀번호 변경 */
export const apiChangePassword = (data: ChangePasswordRequestProps) =>
  request<string>('/app/profiles/passwords', {
    method: 'PUT',
    body: data,
  });

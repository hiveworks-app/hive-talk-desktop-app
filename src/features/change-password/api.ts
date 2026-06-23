import { request } from '@/shared/api';
import type {
  ChangePasswordRequestProps,
  ChangePasswordSmsRequestProps,
  ChangePasswordSmsVerifyRequestProps,
} from './type';

/** SMS 인증번호 발송 (비밀번호 변경, 로그인 사용자 전용) */
export const apiSendChangePasswordSms = (data: ChangePasswordSmsRequestProps) =>
  request<string>('/app/profiles/passwords/verifications', {
    method: 'PUT',
    body: data,
  });

/** SMS 인증코드 검증 (비밀번호 변경, 로그인 사용자 전용) */
export const apiVerifyChangePasswordSms = (data: ChangePasswordSmsVerifyRequestProps) =>
  request<string>('/app/profiles/passwords/verifications/verify', {
    method: 'PUT',
    body: data,
  });

/** 비밀번호 변경 (SMS 본인인증 완료 후) */
export const apiChangePassword = (data: ChangePasswordRequestProps) =>
  request<string>('/app/profiles/passwords', {
    method: 'PUT',
    body: data,
  });

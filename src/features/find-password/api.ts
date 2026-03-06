import { request } from '@/shared/api';
import {
  FindPasswordResetRequest,
  FindPasswordSmsRequest,
  FindPasswordVerifyRequest,
} from './type';

/** SMS 인증번호 발송 (비밀번호 찾기) */
export const apiFindPasswordSendSms = (data: FindPasswordSmsRequest) =>
  request<null>('/public/find/password/sms/verifications', {
    method: 'POST',
    body: data,
  });

/** SMS 인증코드 검증 (비밀번호 찾기) */
export const apiFindPasswordVerify = (data: FindPasswordVerifyRequest) =>
  request<null>('/public/find/password/sms/verifications/verify', {
    method: 'POST',
    body: data,
  });

/** 새 비밀번호 설정 */
export const apiFindPasswordReset = (data: FindPasswordResetRequest) =>
  request<null>('/public/find/password', {
    method: 'PUT',
    body: data,
  });

import { request } from '@/shared/api';
import { FindLoginIdResult, FindLoginIdSmsRequest, FindLoginIdVerifyRequest } from './type';

/** SMS 인증번호 발송 (아이디 찾기) */
export const apiFindLoginIdSendSms = (data: FindLoginIdSmsRequest) =>
  request<null>('/public/find/login-id/sms/verifications', {
    method: 'POST',
    body: data,
  });

/** SMS 인증번호 확인 (아이디 찾기) → 이메일 반환 */
export const apiFindLoginIdVerify = (data: FindLoginIdVerifyRequest) =>
  request<FindLoginIdResult>('/public/find/login-id/sms/verifications/verify', {
    method: 'POST',
    body: data,
  });

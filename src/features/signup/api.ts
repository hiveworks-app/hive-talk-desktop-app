import { publicRequest } from '@/shared/api';
import type {
  MemberType,
  SendSmsRequestProps,
  SignupRequestProps,
  SignupTermsPayload,
  VerifyBusinessRequestProps,
  VerifySmsRequestProps,
} from './type';

export const apiGetSignupTerms = (type: MemberType) => {
  const path = type === 'CORPORATE'
    ? '/public/sign-up/companies/terms'
    : '/public/sign-up/individuals/terms';
  return publicRequest<SignupTermsPayload>(path, { method: 'GET' });
};

export const apiCheckEmail = (email: string) =>
  publicRequest<null>('/public/check/email', {
    method: 'POST',
    body: { email },
  });

export const apiSignup = (type: MemberType, data: SignupRequestProps) => {
  const path = type === 'CORPORATE'
    ? '/public/sign-up/companies'
    : '/public/sign-up/individual';
  return publicRequest<null>(path, { method: 'POST', body: data });
};

export const apiSendSms = (data: SendSmsRequestProps) =>
  publicRequest<null>('/public/sign-up/sms-verifications', {
    method: 'POST',
    body: data,
  });

export const apiVerifySms = (data: VerifySmsRequestProps) =>
  publicRequest<null>('/public/sign-up/sms-verifications/verify', {
    method: 'POST',
    body: data,
  });

export const apiVerifyBusiness = (data: VerifyBusinessRequestProps) =>
  publicRequest<null>('/public/sign-up/companies/verifications', {
    method: 'POST',
    body: data,
  });

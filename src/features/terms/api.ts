import { request } from '@/shared/api';
import type { MyTermsResponse } from './type';

/** 본인의 약관 동의 현황 전체(5종) 조회 */
export const apiGetMyTerms = () => request<MyTermsResponse>('/app/me/terms', { method: 'GET' });

/** 마케팅 약관 동의 ON */
export const apiTurnOnMarketingConsent = () =>
  request<null>('/app/me/terms/optional/marketing/on', { method: 'PUT' });

/** 마케팅 약관 동의 OFF */
export const apiTurnOffMarketingConsent = () =>
  request<null>('/app/me/terms/optional/marketing/off', { method: 'PUT' });

/** 광고성 정보 수신 동의 ON */
export const apiTurnOnAdInfoConsent = () =>
  request<null>('/app/me/terms/optional/ad-info/on', { method: 'PUT' });

/** 광고성 정보 수신 동의 OFF */
export const apiTurnOffAdInfoConsent = () =>
  request<null>('/app/me/terms/optional/ad-info/off', { method: 'PUT' });

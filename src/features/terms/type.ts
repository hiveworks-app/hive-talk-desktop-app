/**
 * 본인 약관 동의 현황 타입.
 *
 * 백엔드 API:
 *  - GET /app/me/terms                          → 본인 약관 동의 현황 조회 (5종)
 *  - PUT /app/me/terms/optional/marketing/(on|off)
 *  - PUT /app/me/terms/optional/ad-info/(on|off)
 *
 * 서버가 SSOT. 토글 시 PUT 호출 후 GET 캐시(setQueryData)로 즉시 반영.
 * type 분기(가입 종류)는 서버가 UserRole에 따라 자동 처리한다.
 */

/** 약관 식별 코드 */
export const TERMS_CODE = {
  AGE_VERIFICATION: 'AGE_VERIFICATION',
  SERVICE: 'SERVICE',
  PERSONAL_DATA: 'PERSONAL_DATA',
  MARKETING: 'MARKETING',
  AD_INFO: 'AD_INFO',
} as const;

export type TermsCode = (typeof TERMS_CODE)[keyof typeof TERMS_CODE];

/** GET /app/me/terms 응답의 개별 약관 항목 */
export interface MyTermsItem {
  id: number;
  version: number;
  code: TermsCode;
  type: string;
  title: string;
  description: string;
  isRequired: boolean;
  effectiveAt: string;
  /** his_terms 최신 row 기준: is_agreed=true AND revoked_at IS NULL 일 때만 true */
  isAgreed: boolean;
  consentedAt: string | null;
  revokedAt: string | null;
}

/** GET /app/me/terms 응답 payload */
export interface MyTermsResponse {
  items: MyTermsItem[];
}

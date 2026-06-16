/**
 * 🚫 계정 정지 정보 (공용)
 * 두 경로에서 동일 형태로 쓰인다:
 *  1. 로그인 SC008 에러 payload
 *  2. 실시간 BROADCAST ACCOUNT/SUSPENDED payload
 * suspendedAt / suspendedUntil: 'YYYY.MM.DD' 형식 문자열
 */
export const ACCOUNT_SUSPENDED_ERROR_CODE = 'SC008';

export interface AccountSuspendedPayload {
  violationCount: string; // 운영정책 위반 건수
  permanent: boolean; // 영구 정지 여부
  suspendedAt: string; // 정지 시작일
  suspendedUntil: string; // 정지 종료일
}

export function isAccountSuspendedPayload(value: unknown): value is AccountSuspendedPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.violationCount === 'string' &&
    typeof v.permanent === 'boolean' &&
    typeof v.suspendedAt === 'string' &&
    typeof v.suspendedUntil === 'string'
  );
}

/**
 * 실시간 BROADCAST ACCOUNT/SUSPENDED payload.
 * userId는 항상 존재(정지 대상 식별용), 정지 상세는 서버 구현에 따라 선택적이다.
 */
export type AccountSuspendedBroadcastPayload = { userId: string | number } & Partial<AccountSuspendedPayload>;

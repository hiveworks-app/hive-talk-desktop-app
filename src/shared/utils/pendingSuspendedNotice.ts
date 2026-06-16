import { AccountSuspendedPayload, isAccountSuspendedPayload } from '@/shared/types/account';

// 실시간 계정 정지(BROADCAST/ACCOUNT/SUSPENDED) → 강제 로그아웃 시 정지 안내 모달 표시용.
// 강제 로그아웃이 화면을 즉시 /login으로 전환하므로, 수신 시점에 모달을 띄우는 대신
// localStorage에 정지 상세를 남기고 로그인 화면 진입 시 한 번 표시 후 자동 삭제한다.
const KEY = 'pendingSuspendedNotice';

export interface PendingSuspendedNotice {
  /** 정지 상세. broadcast에 상세가 없으면 null → 모달은 일반 안내 본문으로 표시 */
  info: AccountSuspendedPayload | null;
}

export function setPendingSuspendedNotice(info: AccountSuspendedPayload | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(info));
  } catch (err) {
    console.warn('[ACCOUNT_SUSPENDED] pendingSuspendedNotice 저장 실패:', err);
  }
}

export function consumePendingSuspendedNotice(): PendingSuspendedNotice | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(KEY);
    if (value == null) return null;
    localStorage.removeItem(KEY);

    try {
      const parsed: unknown = JSON.parse(value);
      return { info: isAccountSuspendedPayload(parsed) ? parsed : null };
    } catch {
      // JSON이 아닌 구버전 값 → 상세 없는 안내로 처리
      return { info: null };
    }
  } catch (err) {
    console.warn('[ACCOUNT_SUSPENDED] pendingSuspendedNotice 조회 실패:', err);
  }
  return null;
}

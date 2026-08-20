/**
 * 소속 해제(MEMBER_DISMISSED) 강제 로그아웃 후 로그인 화면 1회 안내 플래그.
 * 강제 로그아웃이 화면을 즉시 전환하므로, 플래그를 남겨 로그인 화면 진입 시 토스트로 표시한다 (RN 패리티).
 */
const KEY = 'pending-dismissed-toast';

export function setPendingDismissedToast(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* 저장 실패 무시 */
  }
}

/** 플래그 소비 (1회) — 있었으면 true */
export function consumePendingDismissedToast(): boolean {
  try {
    const has = localStorage.getItem(KEY) === '1';
    if (has) localStorage.removeItem(KEY);
    return has;
  } catch {
    return false;
  }
}

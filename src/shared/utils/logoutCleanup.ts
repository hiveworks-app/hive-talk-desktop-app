/**
 * 로그아웃 정리 콜백 레지스트리 (RN logout() 내부 일괄 정리 패리티).
 *
 * RN은 queryClient 싱글턴을 logout()에서 직접 clear하지만, 데스크톱 queryClient는
 * ReactQueryProvider 컴포넌트 내부에서 생성되어 스토어가 접근할 수 없다.
 * 정리 주체가 호출부(설정/탈퇴/계정정지/트레이 등)마다 흩어지면 일부 경로에서
 * 이전 계정 캐시가 잔존한다 (2026-08-26 감사) — Provider가 여기 등록하고
 * authStore.logout()이 일괄 실행한다.
 */
const cleanups = new Set<() => void>();

/** 정리 콜백 등록 — 해제 함수 반환 (Provider unmount 시 호출) */
export function registerLogoutCleanup(fn: () => void): () => void {
  cleanups.add(fn);
  return () => cleanups.delete(fn);
}

/** logout() 시 일괄 실행 — 개별 실패는 다른 정리를 막지 않는다 */
export function runLogoutCleanups(): void {
  cleanups.forEach(fn => {
    try {
      fn();
    } catch {
      // 개별 정리 실패 무시
    }
  });
}

'use client';

/**
 * 부팅/전환 구간 브랜드 로딩 화면 (2026-09-02 윈도우 실측).
 *
 * 루트 리다이렉트·인증 체크 구간이 null을 렌더해 "빈 흰 창"으로 보이던 문제 —
 * 스플래시 창과 같은 시각 언어(로고+스피너)로 이어지게 해 기동 전체가 한 흐름으로 읽히게 한다.
 */
export function BootScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
      <img src="/hivetalk-login-logo.png" alt="" className="h-[72px] w-[72px] object-contain" />
      <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-400" />
    </div>
  );
}

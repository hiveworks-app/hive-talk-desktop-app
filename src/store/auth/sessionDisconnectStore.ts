import { create } from 'zustand';

/** 서버가 중복 로그인으로 세션을 강제 종료할 때 내려주는 코드 (소켓 SESSION/DISCONNECT · REST 401 · refresh 거절 공통) */
export const DUPLICATE_LOGIN_CODE = 'SC010';

/**
 * 중복 로그인 강제 종료 유예 상태 (RN sessionDisconnectStore 패리티).
 * 어느 경로(WS/REST/refresh)로 감지하든 이 플래그 하나로 수렴 —
 * 유예 구간의 자동 재연결/자동 로그아웃/자동 refetch를 일괄 차단하고,
 * 사용자가 안내 다이얼로그를 확인한 시점에 로그아웃한다.
 * persist 불필요 — 확인 전에 앱이 종료되면 다음 실행 시 refresh 401(SC010) 경로가 다시 감지한다.
 */
interface SessionDisconnectState {
  noticeVisible: boolean;
  showNotice: () => void;
  hideNotice: () => void;
}

export const useSessionDisconnectStore = create<SessionDisconnectState>(set => ({
  noticeVisible: false,
  showNotice: () => set({ noticeVisible: true }),
  hideNotice: () => set({ noticeVisible: false }),
}));

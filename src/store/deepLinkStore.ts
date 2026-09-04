import { create } from 'zustand';

/** 메일 '앱에서 인증 완료하기' 딥링크로 도착한 이메일 변경 인증 정보 */
export interface PendingEmailVerify {
  email: string;
  code: string;
  /** 코드 절대 만료 시각(ms) — 없으면 만료 검사 생략(구버전 링크 하위호환, RN 패리티) */
  expiresAt?: number;
}

interface DeepLinkState {
  /** 이메일 변경 화면이 소비 — 소비 시점에 clear (1회성) */
  pendingEmailVerify: PendingEmailVerify | null;
  setPendingEmailVerify: (v: PendingEmailVerify) => void;
  clearPendingEmailVerify: () => void;
}

export const useDeepLinkStore = create<DeepLinkState>(set => ({
  pendingEmailVerify: null,
  setPendingEmailVerify: v => set({ pendingEmailVerify: v }),
  clearPendingEmailVerify: () => set({ pendingEmailVerify: null }),
}));

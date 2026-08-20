import { create } from 'zustand';
import type { MemberInvitePayload } from '@/features/member-invite/type';

/**
 * 🏢 초대 상태 스토어 (RN memberInviteStore 패리티).
 * WebSocket 콜백(Hook 사용 불가) → Store → React Hook 간의 브릿지.
 * persist 불필요 (휘발성 상태 — 로그아웃 시 reset).
 */
interface MemberInviteState {
  /** 사내 소속 초대 대기 (수락/거절 다이얼로그 표시용) */
  pendingInvite: MemberInvitePayload | null;
  setPendingInvite: (invite: MemberInvitePayload | null) => void;

  /** 외부(협력멤버) 초대 미확인 수신 건수 — 봉투 dot·도착 모달의 소스 */
  externalReceivedCount: number;
  setExternalReceivedCount: (count: number) => void;

  /** 초대 도착 모달 '확인하기' → 멤버목록에서 초대현황 자동 오픈 요청 (1회 소비) */
  openInviteStatusRequested: boolean;
  requestOpenInviteStatus: () => void;
  consumeOpenInviteStatus: () => boolean;

  /** 로그아웃 시 전체 초기화 — 다음 로그인 사용자에게 이전 세션 카운트/초대가 노출되지 않도록 */
  reset: () => void;
}

export const useMemberInviteStore = create<MemberInviteState>((set, get) => ({
  pendingInvite: null,
  setPendingInvite: invite => set({ pendingInvite: invite }),

  externalReceivedCount: 0,
  setExternalReceivedCount: count => set({ externalReceivedCount: count }),

  openInviteStatusRequested: false,
  requestOpenInviteStatus: () => set({ openInviteStatusRequested: true }),
  consumeOpenInviteStatus: () => {
    const requested = get().openInviteStatusRequested;
    if (requested) set({ openInviteStatusRequested: false });
    return requested;
  },

  reset: () =>
    set({ pendingInvite: null, externalReceivedCount: 0, openInviteStatusRequested: false }),
}));

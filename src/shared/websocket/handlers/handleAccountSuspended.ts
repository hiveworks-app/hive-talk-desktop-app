import type { WebSocketBroadcastProps } from '@/shared/types/websocket';
import { isAccountSuspendedPayload, type AccountSuspendedBroadcastPayload } from '@/shared/types/account';
import { setPendingSuspendedNotice } from '@/shared/utils/pendingSuspendedNotice';
import { useAuthStore } from '@/store/auth/authStore';
import type { MessageHandlerDeps } from './types';

/**
 * 🚫 실시간 계정 정지(BROADCAST ACCOUNT/SUSPENDED).
 * 본인 계정이면 정지 상세를 localStorage에 남기고 강제 로그아웃 →
 * 로그인 화면 진입 시 모달을 1회 표시한다. (모바일 동작 패리티)
 */
export function handleAccountSuspended(
  envelope: WebSocketBroadcastProps<AccountSuspendedBroadcastPayload>,
  deps: MessageHandlerDeps,
) {
  const payload = envelope.response.payload;
  const suspendedUserId = String(payload.userId);
  const myUserId = deps.loginUserId != null ? String(deps.loginUserId) : null;
  if (!myUserId || suspendedUserId !== myUserId) return;

  console.info('[ACCOUNT_SUSPENDED] 본인 계정 정지 → 강제 로그아웃');

  // 정지 상세(기간/위반 건수)가 포함되면 그대로 저장 → 로그인 화면 모달에 상세 표시
  const suspendedInfo = isAccountSuspendedPayload(payload) ? payload : null;
  setPendingSuspendedNotice(suspendedInfo);

  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') window.location.href = '/login';
}

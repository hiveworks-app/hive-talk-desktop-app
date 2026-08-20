import type { ReceivedInviteItem, SentInviteItem } from '@/features/external-member/type';
import { clampInviteNoticeAckCount } from '@/features/external-member/inviteArrivalNoticeStorage';
import { apiDeletePinnedMember } from '@/features/pinned-members/api';
import type { PushSettingsResponse } from '@/features/notification-settings/type';
import {
  MEMBERS_KEY,
  PINNED_MEMBERS_KEY,
  PUSH_SETTINGS_KEY,
  RECEIVED_INVITES_KEY,
  SENT_INVITES_KEY,
} from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import type {
  ExternalContactDeletedPayload,
  ExternalInviteAcceptedPayload,
  ExternalInviteBroadcastPayload,
  ExternalInviteCancelledPayload,
  ExternalInviteInitPayload,
} from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import type { MessageHandlerDeps } from './types';

/**
 * 📩 외부(협력멤버) 초대 WS 이벤트 처리 (RN WebSocketContext L1531-1834 패리티).
 * 초대 도착/수락/취소/삭제가 실시간으로 받은·보낸 초대 캐시와 뱃지 카운트에 반영된다.
 */

/** INIT/INVITE/EXTERNAL — 최초 연결 시 미확인 수신 건수 세팅 + ack 워터마크 서버 진실 클램프 */
export function applyInitExternalInvite(payload: ExternalInviteInitPayload) {
  const count = Number(payload.receivedCount) || 0;
  useMemberInviteStore.getState().setExternalReceivedCount(count);
  const userId = useAuthStore.getState().user?.id;
  if (userId != null) clampInviteNoticeAckCount(String(userId), count);
}

/** BROADCAST/INVITE/EXTERNAL — PENDING: 받은 초대 캐시 즉시 추가 + 뱃지 +1 / REJECTED: 보낸 초대 제거 */
export function handleBroadcastExternalInvite(
  payload: ExternalInviteBroadcastPayload,
  deps: MessageHandlerDeps,
) {
  const { queryClient } = deps;
  const { inviteId, user, result } = payload;

  if (result === 'PENDING') {
    queryClient.setQueryData<ReceivedInviteItem[]>(RECEIVED_INVITES_KEY, prev => {
      if (!prev) return prev;
      if (prev.some(item => String(item.userId) === String(user.userId))) return prev;
      return [
        {
          inviteId: inviteId ?? String(user.userId),
          userId: String(user.userId),
          name: user.name,
          companyName: user.companyName ?? '',
          profileUrl: user.profileUrl ?? undefined,
          result: 'PENDING',
        },
        ...prev,
      ];
    });
    const store = useMemberInviteStore.getState();
    store.setExternalReceivedCount(store.externalReceivedCount + 1);
    // 포그라운드 안내는 인앱 모달(ExternalInviteArrivalNotice)이 전담 — 시스템 알림 이중 표시 금지 (RN 7/20 QA)
  } else if (result === 'REJECTED') {
    queryClient.setQueryData<SentInviteItem[]>(SENT_INVITES_KEY, prev =>
      prev ? prev.filter(item => String(item.userId) !== String(user.userId)) : prev,
    );
  }
}

/** {INIT|BROADCAST}/EXTERNAL/INVITE_ACCEPTED — 보낸 초대 제거 + 멤버/관심멤버 재조회 (+수락 알림) */
export function applyExternalInviteAccepted(
  payload: ExternalInviteAcceptedPayload,
  deps: MessageHandlerDeps,
  options?: { notify?: boolean },
) {
  const { queryClient } = deps;
  const userId = String(payload.user.userId);

  queryClient.setQueryData<SentInviteItem[]>(SENT_INVITES_KEY, prev =>
    prev ? prev.filter(item => String(item.userId) !== userId) : prev,
  );

  // 신규 멤버(contactedAt) 실값은 서버 재조회로 보강 — INIT payload가 null일 수 있음 (RN 실측)
  queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
  queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });

  if (options?.notify) {
    // 초대 알림 마스터 OFF면 억제 (설정 미로딩 시 표시 — 채팅 알림과 동일 정책)
    const pushSettings = queryClient.getQueryData<PushSettingsResponse>(PUSH_SETTINGS_KEY);
    if (pushSettings && !pushSettings.allInvitesPushEnabled) return;

    const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as
      | { isElectron?: boolean; showNotification?: (data: unknown) => void }
      | undefined;
    if (electronAPI?.isElectron && electronAPI.showNotification) {
      electronAPI.showNotification({
        title: '하이브톡',
        body: `${payload.user.name}님이 멤버 초대를 수락했어요.`,
        // 클릭 시 멤버목록으로 이동 (RN useNotificationNavigator EXTERNAL_INVITE_ACCEPTED 패리티)
        meta: { navigate: 'members', senderName: payload.user.name },
      });
    }
  }
}

/** BROADCAST/EXTERNAL/INVITE_CANCELLED — 받은/보낸 초대 캐시 정리 + 뱃지 감소 */
export function handleExternalInviteCancelled(
  payload: ExternalInviteCancelledPayload,
  deps: MessageHandlerDeps,
) {
  const { queryClient } = deps;
  const otherUserId = String(payload.otherUserId);

  let receivedHadEntry = false;
  queryClient.setQueryData<ReceivedInviteItem[]>(RECEIVED_INVITES_KEY, prev => {
    if (!prev) return prev;
    const next = prev.filter(item => String(item.userId) !== otherUserId);
    receivedHadEntry = next.length !== prev.length;
    return next;
  });
  if (receivedHadEntry) {
    const store = useMemberInviteStore.getState();
    store.setExternalReceivedCount(Math.max(0, store.externalReceivedCount - 1));
  }

  queryClient.setQueryData<SentInviteItem[]>(SENT_INVITES_KEY, prev =>
    prev ? prev.filter(item => String(item.userId) !== otherUserId) : prev,
  );
}

/** {INIT|BROADCAST}/EXTERNAL/CONTACT_DELETED — 협력멤버 양방향 silent 제거 (RN applyExternalContactDeleted 패리티) */
export function applyExternalContactDeleted(
  payload: ExternalContactDeletedPayload,
  deps: MessageHandlerDeps,
) {
  const { queryClient } = deps;
  const removedUserId = String(payload.removedUserId);

  // 1. 멤버/관심멤버 캐시 즉시 제거 (UI 깜빡임 방지)
  for (const key of [MEMBERS_KEY, PINNED_MEMBERS_KEY]) {
    queryClient.setQueryData<MemberItem[]>(key, prev =>
      prev ? prev.filter(member => String(member.userId) !== removedUserId) : prev,
    );
  }

  // 2. 서버 pinned 정리 (fire-and-forget) — 상대가 나를 삭제한 경우 재-친구 시 불일치 방지
  apiDeletePinnedMember([Number(removedUserId)]).catch(err => {
    console.warn('[CONTACT_DELETED] 서버 pinned DELETE 실패:', err);
  });

  // 3. 협력멤버 캐시는 search variants가 다양 → prefix invalidate
  queryClient.invalidateQueries({ queryKey: ['externalMembers'] });

  // 4. 초대 캐시 잔존 방어
  queryClient.setQueryData<SentInviteItem[]>(SENT_INVITES_KEY, prev =>
    prev ? prev.filter(item => String(item.userId) !== removedUserId) : prev,
  );
  queryClient.setQueryData<ReceivedInviteItem[]>(RECEIVED_INVITES_KEY, prev =>
    prev ? prev.filter(item => String(item.userId) !== removedUserId) : prev,
  );
}

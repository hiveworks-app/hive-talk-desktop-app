import type { WebSocketEnvelope, WebSocketChannelTypes } from '@/shared/types/websocket';
import {
  isBroadcast,
  isRoomInvite,
  isReadMessage,
  isPublish,
  isDeleteMessage,
  isAddTagBroadcast,
  isRemoveTagBroadcast,
  isExitMessageRoomBroadcast,
  isBroadcastAccountSuspended,
  isBroadcastProfileUpdated,
  isBroadcastUserBlocked,
  isBroadcastUserUnblocked,
  isInitBlockSync,
  isDeleteMessageSessionFailure,
  isBroadcastMemberInvite,
  isInitMemberInvite,
  isBroadcastMemberJoined,
  isInitMemberJoined,
  isBroadcastMemberDismissed,
  isInitExternalInvite,
  isBroadcastExternalInvite,
  isInitExternalInviteAccepted,
  isBroadcastExternalInviteAccepted,
  isBroadcastExternalInviteCancelled,
  isBroadcastExternalContactDeleted,
  isInitExternalContactDeleted,
  isBroadcastDmMemberRemoved,
  isInitDmMemberRemoved,
  isBroadcastCompanyMemberRemoved,
  isInitCompanyMemberRemoved,
  isInitProfileUpdated,
  parseSocketResponseType,
} from '@/shared/types/websocket';
import { setPendingDismissedToast } from '@/shared/utils/pendingDismissedToast';
import { handleForceLogout } from '@/shared/api/refreshAccessToken';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { useUIStore } from '@/store/uiStore';
import type { MessageHandlerDeps } from './types';
import { handleReadMessage } from './handleReadMessage';
import { handlePublish } from './handlePublish';
import {
  handleRoomInvite,
  handleDeleteMessage,
  handleAddTag,
  handleRemoveTag,
  handleExitRoom,
} from './handleOther';
import { handleAccountSuspended } from './handleAccountSuspended';
import { handleProfileUpdated } from './handleProfileUpdated';
import { applyBlockSync } from './handleBlockSync';
import { applyCompanyMemberRemoved, applyDmMemberRemoved } from './handleMemberRemoved';
import {
  applyExternalContactDeleted,
  applyExternalInviteAccepted,
  applyInitExternalInvite,
  handleBroadcastExternalInvite,
  handleExternalInviteCancelled,
} from './handleExternalInvite';

export function routeMessage(rawData: string, deps: MessageHandlerDeps) {
  let envelope: WebSocketEnvelope;

  try {
    envelope = JSON.parse(rawData) as WebSocketEnvelope;
  } catch {
    Object.values(deps.listenersRef.current).forEach(listener =>
      listener(rawData as unknown as WebSocketEnvelope),
    );
    return;
  }

  let globalChannelType: WebSocketChannelTypes | undefined;

  if (isBroadcast(envelope)) {
    const { channelType } = envelope.response;
    globalChannelType =
      channelType ||
      (parseSocketResponseType(envelope.socketResponseType)?.channelType as WebSocketChannelTypes | undefined);
  }

  // 🚫 실시간 계정 정지 — 본인이면 강제 로그아웃 (최우선 처리)
  if (isBroadcastAccountSuspended(envelope)) {
    handleAccountSuspended(envelope, deps);
    return;
  }

  // 👤 프로필 변경 실시간 반영 (멤버/참여자/이미지 캐시 갱신) — INIT은 재연결 보강, 동일 핸들러 재사용
  if (isBroadcastProfileUpdated(envelope) || isInitProfileUpdated(envelope)) {
    handleProfileUpdated(envelope, deps);
    return;
  }

  // 🏢 사내(소속) 초대 — 실시간 수신/취소 + 재연결 시 pending 보강 (RN 패리티)
  if (isBroadcastMemberInvite(envelope)) {
    const payload = envelope.response.payload;
    if (payload.result === 'CANCELLED') {
      useMemberInviteStore.getState().setPendingInvite(null);
      useUIStore.getState().showSnackbar({ message: '만료된 초대입니다. 소속 회사 관리자에게 문의해 주세요.', state: 'error' });
    } else {
      useMemberInviteStore.getState().setPendingInvite(payload);
    }
    return;
  }
  if (isInitMemberInvite(envelope)) {
    const pending = envelope.response.payload.find(item => item.result === 'PENDING');
    if (pending) useMemberInviteStore.getState().setPendingInvite(pending);
    return;
  }

  // 🏢 새 멤버 합류 — 멤버 리스트 재수렴
  if (isBroadcastMemberJoined(envelope) || isInitMemberJoined(envelope)) {
    deps.queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
    return;
  }

  // 🚪 소속 해제 — 본인이면 강제 로그아웃 + 로그인 화면 1회 토스트 (정책 member.md §소속 해제)
  if (isBroadcastMemberDismissed(envelope)) {
    const dismissedUserId = String(envelope.response.payload.dismissedUserId);
    const myUserId = deps.loginUserId != null ? String(deps.loginUserId) : null;
    if (myUserId && dismissedUserId === myUserId) {
      console.info('[MEMBER_DISMISSED] 본인 소속 해제 → 강제 로그아웃');
      setPendingDismissedToast();
      handleForceLogout();
    }
    return;
  }

  // 📩 외부(협력멤버) 초대 이벤트 — 실시간 수신/수락/취소/삭제 (RN 패리티)
  if (isInitExternalInvite(envelope)) {
    applyInitExternalInvite(envelope.response.payload);
    return;
  }
  if (isBroadcastExternalInvite(envelope)) {
    handleBroadcastExternalInvite(envelope.response.payload, deps);
    return;
  }
  if (isInitExternalInviteAccepted(envelope)) {
    applyExternalInviteAccepted(envelope.response.payload, deps);
    return;
  }
  if (isBroadcastExternalInviteAccepted(envelope)) {
    applyExternalInviteAccepted(envelope.response.payload, deps, { notify: true });
    return;
  }
  if (isBroadcastExternalInviteCancelled(envelope)) {
    handleExternalInviteCancelled(envelope.response.payload, deps);
    return;
  }
  if (isBroadcastExternalContactDeleted(envelope) || isInitExternalContactDeleted(envelope)) {
    applyExternalContactDeleted(envelope.response.payload, deps);
    return;
  }

  // 👋 멤버 제거 (회원탈퇴·소속해제) — BROADCAST(실시간) + INIT(재연결 보강) 쌍 처리
  if (isBroadcastCompanyMemberRemoved(envelope) || isInitCompanyMemberRemoved(envelope)) {
    applyCompanyMemberRemoved(deps);
    return;
  }
  if (isBroadcastDmMemberRemoved(envelope) || isInitDmMemberRemoved(envelope)) {
    const { roomId, removedUserId } = envelope.response.payload;
    if (roomId && removedUserId != null) {
      applyDmMemberRemoved(roomId, String(removedUserId), deps);
    }
    return;
  }

  // 🚫 차단 동기화 — 실시간 단건(BROADCAST) + 재연결 누적 델타(INIT) 공용 적용
  if (isBroadcastUserBlocked(envelope)) {
    applyBlockSync([envelope.response.payload], [], deps);
    return;
  }
  if (isBroadcastUserUnblocked(envelope)) {
    applyBlockSync([], [envelope.response.payload], deps);
    return;
  }
  if (isInitBlockSync(envelope)) {
    const payload = envelope.response.payload;
    applyBlockSync(payload?.blocked ?? [], payload?.unblocked ?? [], deps);
    return;
  }

  if (isRoomInvite(envelope)) {
    handleRoomInvite(envelope, globalChannelType, deps);
    return;
  }

  if (isReadMessage(envelope)) {
    handleReadMessage(envelope, globalChannelType, deps);
    return;
  }

  if (isPublish(envelope)) {
    handlePublish(envelope, globalChannelType, deps);
    return;
  }

  // ❌ 메시지 삭제 SESSION 실패 (예: 24시간 초과 DM006) → 서버 message를 그대로 토스트.
  // 클라이언트가 24h 게이팅으로 삭제 메뉴를 숨기지만, 경계값/시계 오차로 새어나간 요청의 최종 방어선
  if (isDeleteMessageSessionFailure(envelope)) {
    const failMessage = envelope.response.message?.trim() || '메시지를 삭제할 수 없습니다.';
    useUIStore.getState().showSnackbar({ message: failMessage, state: 'error' });
    return;
  }

  if (isDeleteMessage(envelope)) {
    handleDeleteMessage(envelope, globalChannelType, deps);
    return;
  }

  if (isAddTagBroadcast(envelope)) {
    handleAddTag(envelope, deps);
    return;
  }

  if (isRemoveTagBroadcast(envelope)) {
    handleRemoveTag(envelope, deps);
    return;
  }

  if (isExitMessageRoomBroadcast(envelope)) {
    handleExitRoom(envelope, deps);
    return;
  }

  // 기타 메시지
  Object.values(deps.listenersRef.current).forEach(listener => listener(envelope));
}

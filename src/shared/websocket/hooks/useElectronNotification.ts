'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useQueryClient } from '@tanstack/react-query';
import { roomPath } from '@/shared/hooks/useRoomIdParam';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { countDMTotalUsers, countRoomListTotalUsers } from '@/shared/utils/roomUserCount';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { WS_CHANNEL_TYPE, WS_OPERATION } from '@/shared/types/websocket';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { getTargetQueryKey } from '../handlers/types';

interface UseElectronNotificationDeps {
  routerRef: MutableRefObject<AppRouterInstance>;
  sendRef: MutableRefObject<(data: unknown) => void>;
  pendingReadCallbacksRef: MutableRefObject<Map<string, () => void>>;
  /** 멀티 채팅창(팝업)에서는 끈다 — 알림 클릭 시 팝업이 다른 방으로 이동해버리고, 허브가 이미 처리한다 */
  enabled?: boolean;
}

export function useElectronNotification(deps: UseElectronNotificationDeps) {
  const queryClient = useQueryClient();
  const { routerRef, sendRef, pendingReadCallbacksRef, enabled = true } = deps;

  // 알림 클릭 → 해당 채팅방으로 이동
  useEffect(() => {
    if (!enabled) return;
    const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as
      | {
          isElectron?: boolean;
          onNotificationClicked?: (
            callback: (meta: { roomId?: string; channelType?: string; senderName?: string; notReadCount?: number; navigate?: string }) => void,
          ) => () => void;
        }
      | undefined;

    if (!electronAPI?.isElectron || !electronAPI.onNotificationClicked) return;

    const cleanup = electronAPI.onNotificationClicked((meta) => {
      // 초대 수락 등 라우트 지정 알림 — 방 진입 대신 지정 화면으로 이동 (RN 패리티)
      if (meta.navigate === 'members') {
        // 최신 멤버 목록 재수렴 후 진입 (RN MEMBERS_KEY invalidate 패리티)
        queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
        routerRef.current.push('/members');
        return;
      }
      // 받은 초대(PENDING) 알림 — 멤버목록 이동 + 초대현황 자동 오픈 (RN /invite-status 패리티)
      if (meta.navigate === 'invite-status') {
        useMemberInviteStore.getState().requestOpenInviteStatus();
        routerRef.current.push('/members');
        return;
      }
      const { roomId, channelType, senderName, notReadCount: metaNotReadCount } = meta;
      if (!roomId) return;
      const targetQueryKey = getTargetQueryKey(channelType as WebSocketChannelTypes);
      const rooms = targetQueryKey
        ? queryClient.getQueryData<GetChatRoomListItemType[]>(targetQueryKey)
        : undefined;
      const room = rooms?.find(r => r.roomModel.roomId === roomId);

      const reliableNotReadCount = Math.max(metaNotReadCount ?? 0, room?.notReadCount ?? 0);

      if (room) {
        const { roomModel } = room;
        const isOtherUserExit = roomModel.participantDetail?.isExit ?? false;
        // GM 목록 participants는 본인 제외 — 단일 유틸로 총원 계산 (RN roomUserCount 패리티)
        const totalUserCount =
          channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
            ? countDMTotalUsers(isOtherUserExit)
            : countRoomListTotalUsers(channelType as WebSocketChannelTypes, roomModel.participants);
        const invitedUserIds =
          channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE &&
          isOtherUserExit &&
          roomModel.participantDetail?.userId
            ? [String(roomModel.participantDetail.userId)]
            : [];

        // DM은 상대 이름 우선 (RN 패리티)
        const displayName =
          channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
            ? roomModel.participantDetail?.name || roomModel.title || senderName
            : roomModel.title ||
              roomModel.participants?.map(p => p.name).join(', ') ||
              senderName;

        useChatRoomInfo.getState().setChatRoomInfo({
          roomId: roomModel.roomId,
          roomName: displayName,
          channelType: channelType as WebSocketChannelTypes,
          totalUserCount,
          otherUserIsExit: isOtherUserExit,
          // 방 스코프 플래그 — partial merge 잔존 방지 명시 재설정 (RN 교훈)
          otherUserIsRemoved: roomModel.participantDetail?.isRemoved ?? false,
          lastMessage: room.messageList?.[0] ?? null,
          invitedUserIds,
          initialNotReadCount: reliableNotReadCount,
        });
      } else {
        useChatRoomInfo.getState().setChatRoomInfo({
          roomId,
          roomName: senderName,
          channelType: (channelType as WebSocketChannelTypes) ?? WS_CHANNEL_TYPE.DIRECT_MESSAGE,
          otherUserIsRemoved: false,
          initialNotReadCount: metaNotReadCount ?? 0,
        });
      }

      // EM(협력채팅)은 전용 라우트로 — /chat 고정 라우팅 버그 수정 (RN 패리티)
      const routePrefix = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? '/external-chat' : '/chat';
      routerRef.current.push(roomPath(routePrefix, roomId));
    });

    return cleanup;
  }, [queryClient, routerRef, enabled]);

  // 알림 "읽음" 버튼 → 해당 채팅방 읽음 처리
  useEffect(() => {
    if (!enabled) return;
    const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as
      | {
          isElectron?: boolean;
          onNotificationRead?: (
            callback: (meta: { roomId: string; channelType: string }) => void,
          ) => () => void;
        }
      | undefined;

    if (!electronAPI?.isElectron || !electronAPI.onNotificationRead) return;

    const cleanup = electronAPI.onNotificationRead((meta) => {
      const { roomId, channelType } = meta;

      const timeoutId = setTimeout(() => {
        if (pendingReadCallbacksRef.current.has(roomId)) {
          console.log('[VIEW] 🔴 VIEW_OUT 전송 (notification-read timeout)', roomId);
          pendingReadCallbacksRef.current.delete(roomId);
          sendRef.current({
            operationType: WS_OPERATION.VIEW_OUT_MESSAGE_ROOM,
            channelType,
            channelId: roomId,
            payload: null,
          });
        }
      }, 3000);

      pendingReadCallbacksRef.current.set(roomId, () => {
        console.log('[VIEW] 🔴 VIEW_OUT 전송 (notification-read callback)', roomId);
        clearTimeout(timeoutId);
        sendRef.current({
          operationType: WS_OPERATION.VIEW_OUT_MESSAGE_ROOM,
          channelType,
          channelId: roomId,
          payload: null,
        });
      });

      console.log('[VIEW] 🟢 VIEW_IN 전송 (notification-read)', roomId);
      sendRef.current({
        operationType: WS_OPERATION.VIEW_IN_MESSAGE_ROOM,
        channelType,
        channelId: roomId,
        payload: null,
      });
    });

    return cleanup;
  }, [sendRef, pendingReadCallbacksRef, enabled]);
}

'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useQueryClient } from '@tanstack/react-query';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { WS_CHANNEL_TYPE, WS_OPERATION } from '@/shared/types/websocket';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { getTargetQueryKey } from '../handlers/types';

interface UseElectronNotificationDeps {
  routerRef: MutableRefObject<AppRouterInstance>;
  sendRef: MutableRefObject<(data: unknown) => void>;
  pendingReadCallbacksRef: MutableRefObject<Map<string, () => void>>;
}

export function useElectronNotification(deps: UseElectronNotificationDeps) {
  const queryClient = useQueryClient();
  const { routerRef, sendRef, pendingReadCallbacksRef } = deps;

  // 알림 클릭 → 해당 채팅방으로 이동
  useEffect(() => {
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
        const totalUserCount = roomModel.participants?.length ?? 2;
        const isOtherUserExit = roomModel.participantDetail?.isExit ?? false;
        const invitedUserIds =
          channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE &&
          isOtherUserExit &&
          roomModel.participantDetail?.userId
            ? [String(roomModel.participantDetail.userId)]
            : [];

        const displayName =
          roomModel.title ||
          roomModel.participantDetail?.name ||
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
      routerRef.current.push(`${routePrefix}/${roomId}`);
    });

    return cleanup;
  }, [queryClient, routerRef]);

  // 알림 "읽음" 버튼 → 해당 채팅방 읽음 처리
  useEffect(() => {
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
  }, [sendRef, pendingReadCallbacksRef]);
}

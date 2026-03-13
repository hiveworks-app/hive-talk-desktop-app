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
            callback: (meta: { roomId: string; channelType: string; senderName: string; notReadCount?: number }) => void,
          ) => () => void;
        }
      | undefined;

    if (!electronAPI?.isElectron || !electronAPI.onNotificationClicked) return;

    const cleanup = electronAPI.onNotificationClicked((meta) => {
      const { roomId, channelType, senderName, notReadCount: metaNotReadCount } = meta;
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
          lastMessage: room.messageList?.[0] ?? null,
          invitedUserIds,
          initialNotReadCount: reliableNotReadCount,
        });
      } else {
        useChatRoomInfo.getState().setChatRoomInfo({
          roomId,
          roomName: senderName,
          channelType: (channelType as WebSocketChannelTypes) ?? WS_CHANNEL_TYPE.DIRECT_MESSAGE,
          initialNotReadCount: metaNotReadCount ?? 0,
        });
      }

      routerRef.current.push(`/chat/${roomId}`);
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

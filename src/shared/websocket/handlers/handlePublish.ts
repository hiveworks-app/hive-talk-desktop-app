import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { upsertChatRoomListWithMessage } from '@/features/chat-room-list/updater';
import { apiGetStorage } from '@/features/storage/api';
import { WS_CHANNEL_TYPE, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import type {
  WebSocketEnvelope,
  WebSocketChannelTypes,
  WebSocketSingleMessagePayload,
  WebSocketReceiveReadItemProps,
  WebSocketReceiveTagProps,
} from '@/shared/types/websocket';
import { PUSH_SETTINGS_KEY } from '@/shared/config/queryKeys';
import type { PushSettingsResponse } from '@/features/notification-settings/type';
import type { MessageHandlerDeps } from './types';
import { getTargetQueryKey } from './types';

export function handlePublish(
  envelope: WebSocketEnvelope,
  globalChannelType: WebSocketChannelTypes | undefined,
  deps: MessageHandlerDeps,
) {
  const { queryClient, listenersRef, isElectronRef, loginUserId } = deps;
  const pubPayload = envelope.response.payload as WebSocketSingleMessagePayload;
  const roomId = pubPayload.message.roomId;
  const currentChannelType = globalChannelType || (envelope.response as { channelType?: WebSocketChannelTypes }).channelType;

  // readItems 정규화
  const rawReadItems: WebSocketReceiveReadItemProps[] = Array.isArray(pubPayload.readItems)
    ? (pubPayload.readItems as unknown as WebSocketReceiveReadItemProps[])
    : (pubPayload.readItems?.items ?? []);

  const senderId = pubPayload.sender?.userId;
  const hasSenderRead = rawReadItems.some(item => item.userId === senderId);
  if (senderId && !hasSenderRead) {
    rawReadItems.push({
      roomId,
      messageId: pubPayload.message.id,
      userId: senderId,
      readAt: new Date(pubPayload.message.createdAt),
    });
  }

  const normalizedPayload: WebSocketSingleMessagePayload = {
    ...pubPayload,
    tag: Array.isArray(pubPayload.tag)
      ? { items: pubPayload.tag as unknown as WebSocketReceiveTagProps[] }
      : (pubPayload.tag ?? { items: [] }),
    readItems: { items: rawReadItems },
  };

  const isMySentMessage = normalizedPayload.sender?.userId === String(loginUserId);
  const listener = listenersRef.current[roomId];
  const isRoomActive = Boolean(listener) && document.hasFocus();
  if (listener) listener(envelope);

  // 채팅방 목록 React Query 캐시 갱신
  const targetQueryKey = getTargetQueryKey(currentChannelType);
  if (targetQueryKey) {
    const prev = queryClient.getQueryData<GetChatRoomListItemType[]>(targetQueryKey);
    const list = prev ?? [];
    const hasRoom = list.some(room => room.roomModel.roomId === roomId);

    if (hasRoom) {
      queryClient.setQueryData<GetChatRoomListItemType[]>(
        targetQueryKey,
        upsertChatRoomListWithMessage(list, normalizedPayload, { isRoomActive }),
      );
    } else {
      queryClient.invalidateQueries({ queryKey: targetQueryKey });
    }
  } else {
    console.warn('[WS] ⚠️ PUB: targetQueryKey가 null — channelType:', currentChannelType, 'socketResponseType:', envelope.socketResponseType);
  }

  // 방 제목 변경 브로드캐스트 → 룸리스트 title + (현재 진입 중인 방이면) chatRoomInfo 즉시 갱신 (RN 패리티)
  if (pubPayload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE) {
    const newTitle = (pubPayload.message.payload as { content?: string } | null)?.content;
    if (newTitle && targetQueryKey) {
      queryClient.setQueryData<GetChatRoomListItemType[]>(targetQueryKey, prev =>
        prev?.map(room =>
          room.roomModel.roomId === roomId
            ? { ...room, roomModel: { ...room.roomModel, title: newTitle } }
            : room,
        ) ?? [],
      );
      if (useChatRoomInfo.getState().roomId === roomId) {
        useChatRoomInfo.getState().setChatRoomInfo({ roomName: newTitle });
      }
    }
  }

  // 알림 (내가 보낸 메시지가 아니고, 방이 비활성이거나 창에 포커스가 없을 때)
  const isWindowInactive = isElectronRef.current && !document.hasFocus();
  if (!isMySentMessage && (!isRoomActive || isWindowInactive)) {
    sendNotification(normalizedPayload, roomId, currentChannelType, targetQueryKey, queryClient);
  }
}

function sendNotification(
  payload: WebSocketSingleMessagePayload,
  roomId: string,
  channelType: WebSocketChannelTypes | undefined,
  targetQueryKey: readonly string[] | null,
  queryClient: { getQueryData: <T>(key: readonly string[]) => T | undefined },
) {
  // 채팅 알림 마스터 OFF면 데스크톱 로컬 알림도 억제 (서버 push와 동일 정책).
  // 설정 미로딩(undefined) 시에는 기존처럼 알림 표시.
  const pushSettings = queryClient.getQueryData<PushSettingsResponse>(PUSH_SETTINGS_KEY);
  if (pushSettings && !pushSettings.allRoomsPushEnabled) return;

  const senderName = payload.sender?.name ?? '사용자';
  const body = payload.message.payload && 'content' in payload.message.payload
    ? payload.message.payload.content
    : '새 메시지';

  const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as
    | { isElectron?: boolean; showNotification?: (data: unknown) => void }
    | undefined;

  if (electronAPI?.isElectron && electronAPI.showNotification) {
    const updatedRooms = targetQueryKey
      ? queryClient.getQueryData<GetChatRoomListItemType[]>(targetQueryKey)
      : undefined;
    const currentNotReadCount = updatedRooms?.find(
      (r: GetChatRoomListItemType) => r.roomModel.roomId === roomId,
    )?.notReadCount ?? 0;

    const notificationMeta = {
      roomId,
      channelType: channelType ?? WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      senderName,
      notReadCount: currentNotReadCount,
    };

    const storageKey =
      payload.sender?.thumbnailProfileUrl ||
      payload.sender?.profileImageUrl ||
      payload.sender?.profileUrl;

    if (storageKey) {
      apiGetStorage(storageKey)
        .then(res => {
          electronAPI.showNotification!({
            title: senderName, body, profileImageUrl: res.payload.key, meta: notificationMeta,
          });
        })
        .catch(() => {
          electronAPI.showNotification!({
            title: senderName, body, meta: notificationMeta,
          });
        });
    } else {
      electronAPI.showNotification({ title: senderName, body, meta: notificationMeta });
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(senderName, { body, tag: roomId });
  }
}

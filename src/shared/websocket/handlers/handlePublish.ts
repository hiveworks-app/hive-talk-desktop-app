import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { upsertChatRoomListWithMessage } from '@/features/chat-room-list/updater';
import { apiGetStorage } from '@/features/storage/api';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import type {
  WebSocketEnvelope,
  WebSocketChannelTypes,
  WebSocketSingleMessagePayload,
  WebSocketReceiveReadItemProps,
  WebSocketReceiveTagProps,
} from '@/shared/types/websocket';
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
  const isRoomActive = Boolean(listener);
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

  // 알림 (내가 보낸 메시지가 아니고, 방이 비활성이거나 Electron 창이 숨겨진 상태일 때)
  const isWindowHidden = isElectronRef.current && document.visibilityState === 'hidden';
  if (!isMySentMessage && (!isRoomActive || isWindowHidden)) {
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

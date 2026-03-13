import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import type {
  WebSocketEnvelope,
  WebSocketChannelTypes,
  WebSocketReceiveReadItemProps,
} from '@/shared/types/websocket';
import type { MessageHandlerDeps } from './types';
import { getTargetQueryKey } from './types';

export function handleReadMessage(
  envelope: WebSocketEnvelope,
  globalChannelType: WebSocketChannelTypes | undefined,
  deps: MessageHandlerDeps,
) {
  const { queryClient, processedReadEventsRef, listenersRef, pendingReadCallbacksRef, loginUserId } = deps;
  const currentChannelType = globalChannelType || (envelope.response as { channelType?: WebSocketChannelTypes }).channelType;
  const { items: readItems } = envelope.response.payload as { items: WebSocketReceiveReadItemProps[] };

  // 중복 이벤트 필터링
  const newMyReadItems = readItems.filter((item: WebSocketReceiveReadItemProps) => {
    const eventKey = `${item.messageId}:${item.userId}`;
    if (processedReadEventsRef.current.has(eventKey)) return false;
    processedReadEventsRef.current.add(eventKey);
    return item.userId === String(loginUserId);
  });

  // notReadCount 감소
  if (newMyReadItems.length > 0) {
    const readCountByRoom = new Map<string, number>();
    newMyReadItems.forEach((item: WebSocketReceiveReadItemProps) => {
      const current = readCountByRoom.get(item.roomId) ?? 0;
      readCountByRoom.set(item.roomId, current + 1);
    });

    const targetQueryKey = getTargetQueryKey(currentChannelType);
    if (targetQueryKey) {
      queryClient.setQueryData(
        targetQueryKey,
        (prev: GetChatRoomListItemType[] | undefined) => {
          if (!prev) return prev;
          return prev.map(room => {
            const decrementCount = readCountByRoom.get(room.roomModel.roomId);
            if (decrementCount) {
              return {
                ...room,
                notReadCount: Math.max(0, (room.notReadCount ?? 0) - decrementCount),
              };
            }
            return room;
          });
        },
      );
    }
  }

  // readItems를 메시지리스트에 병합
  if (readItems.length > 0) {
    const targetQueryKey = getTargetQueryKey(currentChannelType);
    if (targetQueryKey) {
      queryClient.setQueryData(
        targetQueryKey,
        (prev: GetChatRoomListItemType[] | undefined) => {
          if (!prev) return prev;

          const readItemsByMessageId = new Map<string, WebSocketReceiveReadItemProps[]>();
          readItems.forEach((readItem: WebSocketReceiveReadItemProps) => {
            const existing = readItemsByMessageId.get(readItem.messageId) ?? [];
            readItemsByMessageId.set(readItem.messageId, [...existing, readItem]);
          });

          return prev.map(room => {
            const hasReadEvent = readItems.some(
              (item: WebSocketReceiveReadItemProps) => item.roomId === room.roomModel.roomId,
            );
            if (!hasReadEvent) return room;

            const updatedMessageList = room.messageList.map(msg => {
              const newReadItems = readItemsByMessageId.get(msg.message.id);
              if (!newReadItems) return msg;

              const existingReadItems = msg.readItems?.items ?? [];
              const existingUserIds = new Set(existingReadItems.map(r => r.userId));
              const filteredNewReadItems = newReadItems.filter(
                r => !existingUserIds.has(r.userId),
              );

              if (filteredNewReadItems.length === 0) return msg;

              return {
                ...msg,
                readItems: { items: [...existingReadItems, ...filteredNewReadItems] },
              };
            });

            return { ...room, messageList: updatedMessageList };
          });
        },
      );
    }
  }

  // 알림 "읽음" 버튼으로 등록된 일회성 콜백 실행
  readItems.forEach((item: WebSocketReceiveReadItemProps) => {
    const cb = pendingReadCallbacksRef.current.get(item.roomId);
    if (cb) {
      pendingReadCallbacksRef.current.delete(item.roomId);
      cb();
    }
  });

  Object.values(listenersRef.current).forEach(listener => listener(envelope));
}

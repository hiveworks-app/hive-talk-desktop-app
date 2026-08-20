import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';

type ChatRoomList = GetChatRoomListItemType[];

interface UpsertOptions {
  isRoomActive?: boolean;
  /** 차단 발신자 메시지 — 안읽음 미증가 + 목록 상단 이동 금지(sortAt freeze) (정책 block.md) */
  isBlockedSender?: boolean;
}

export function upsertChatRoomListWithMessage(
  prev: ChatRoomList | undefined,
  wsItem: WebSocketPublishItem,
  options?: UpsertOptions,
): ChatRoomList {
  if (!prev) return prev ?? [];

  const roomId = wsItem.message.roomId;
  const loginUserId = useAuthStore.getState().user?.id;
  const sendUserId = wsItem.message.senderId;
  const isMe = sendUserId === loginUserId;
  const isRoomActive = options?.isRoomActive ?? false;

  if (!roomId || !loginUserId) {
    return prev;
  }

  const newLastMessage: WebSocketPublishItem = {
    message: wsItem.message,
    sender: wsItem.sender,
    tag: wsItem.tag ?? { items: [] },
    readItems: wsItem.readItems ?? { items: [] },
  };

  const idx = prev.findIndex(room => room.roomModel.roomId === roomId);
  if (idx >= 0) {
    const target = prev[idx];
    const targetNotReadCount = target.notReadCount ?? 0;
    const isBlockedSender = options?.isBlockedSender ?? false;

    const shouldIncreaseUnread = !isMe && !isRoomActive && !isBlockedSender;
    const nextNotReadCount = shouldIncreaseUnread ? targetNotReadCount + 1 : targetNotReadCount;

    const updated: GetChatRoomListItemType = {
      ...target,
      messageList: [newLastMessage, ...prev[idx].messageList],
      notReadCount: nextNotReadCount,
      // 차단 발신자: 정렬 기준 시각을 이전 값으로 freeze — 상단 이동 금지 (RN sortAt 패리티)
      sortAt: isBlockedSender
        ? (target.sortAt ?? target.messageList[0]?.message.createdAt)
        : wsItem.message.createdAt,
    };

    // 차단 발신자 메시지는 제자리 갱신만 (배열 순서 유지)
    if (isBlockedSender) {
      const clone = [...prev];
      clone[idx] = updated;
      return clone;
    }

    const clone = [...prev];
    clone.splice(idx, 1);
    return [updated, ...clone];
  }

  return prev ?? [];
}

export function updateChatRoomListWithDeletion(
  prev: ChatRoomList | undefined,
  targetRoomId: string,
  targetMessageId: string,
): ChatRoomList {
  if (!prev) return [];

  return prev.map(room => {
    if (room.roomModel.roomId !== targetRoomId) return room;

    const hasTargetMessage = room.messageList.some(msg => msg.message.id === targetMessageId);
    if (!hasTargetMessage) return room;

    const updatedMessageList = room.messageList.map(msg => {
      if (msg.message.id === targetMessageId) {
        return {
          ...msg,
          message: {
            ...msg.message,
            isDeleted: true,
            text: '삭제된 메시지입니다.',
          },
        };
      }
      return msg;
    });

    return { ...room, messageList: updatedMessageList };
  });
}

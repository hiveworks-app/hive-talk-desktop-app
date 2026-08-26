import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import {
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketPublishItem,
  isSystemMessageContentType,
  type WebSocketReceiveMessageProps,
} from '@/shared/types/websocket';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
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

    // RN 5조건 패리티 — 시스템 메시지(초대/나감/제목/공지)는 안읽음 대상이 아니고,
    // READ가 PUBLISH보다 먼저 도착해 readItems에 내가 이미 있으면(단조 집합) 증가하지 않는다.
    const isSystemMessage = isSystemMessageContentType(wsItem.message.messageContentType);
    const isAlreadyReadByMe = (newLastMessage.readItems?.items ?? []).some(
      item => String(item.userId) === String(loginUserId),
    );
    const shouldIncreaseUnread =
      !isMe && !isRoomActive && !isSystemMessage && !isBlockedSender && !isAlreadyReadByMe;
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
            // 미리보기 문구는 chatUtils의 isDeleted 분기가 담당 — 여기선 플래그·text만 갱신
            text: IS_DELETE_MESSAGE_COMMENTS,
          },
        };
      }
      return msg;
    });

    return { ...room, messageList: updatedMessageList };
  });
}

/**
 * 신고 마스킹을 목록 캐시 미리보기에 반영한다 (RN updateChatRoomListWithReport 패리티).
 * - REPORTED(신고 접수, 신고자 본인) → REPORTED_MASK 안내 버블
 * - REPORT_HIDDEN(신고 확정, 전원) → SYSTEM_REPORTED 시스템 안내
 * 미이식 시 신고 후에도 목록에 원문 미리보기가 남는다 (2026-08-26 감사).
 */
export function updateChatRoomListWithReport(
  prev: ChatRoomList | undefined,
  targetRoomId: string,
  targetMessageId: string,
  content: string,
  maskContentType:
    | typeof WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK
    | typeof WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED,
): ChatRoomList {
  if (!prev) return [];

  return prev.map(room => {
    if (room?.roomModel?.roomId !== targetRoomId) return room;
    const hasTargetMessage = room.messageList.some(msg => msg.message.id === targetMessageId);
    if (!hasTargetMessage) return room;

    const updatedMessageList = room.messageList.map(msg =>
      msg.message.id === targetMessageId
        ? {
            ...msg,
            // 마스킹 타입/문구/payload 동시 교체 — 서버 메시지 유니온에는 클라 치환 타입이
            // 없어 단언이 불가피 (chatUtils의 마스킹 case가 content만 읽는다)
            message: {
              ...msg.message,
              text: content,
              messageContentType: maskContentType,
              payload: { content },
            } as unknown as WebSocketReceiveMessageProps,
          }
        : msg,
    );
    return { ...room, messageList: updatedMessageList };
  });
}

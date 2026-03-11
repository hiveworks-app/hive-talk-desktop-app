import { readCountCalculator } from '@/features/chat-room/domain';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import {
  Message,
  MessageFileItem,
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketMediaFileMessageItemsProps,
  WebSocketPublishItem,
  WebSocketReceiveTagProps,
  WebSocketSubmitInvitePayload,
} from '@/shared/types/websocket';
import { formatKoreanTime } from '@/shared/utils/formatTimeUtils';

type MessageParser = {
  item: WebSocketPublishItem;
};

export function createWsMessageParser(params: {
  getLoginUserId: () => string | number | null | undefined;
  getParticipants: () => ParticipantItemsType[];
  getTotalUserCount: () => number;
  consumeNextMyTags?: () => WebSocketReceiveTagProps[] | null;
}) {
  const { getLoginUserId, getParticipants, getTotalUserCount, consumeNextMyTags } = params;

  return function parseWsMessage(input: MessageParser): Message | null {
    const { item } = input;
    const { message, sender, tag, readItems } = item;
    const { messageContentType, payload } = message;

    const loginUserId = getLoginUserId();
    const participants = getParticipants();

    const sendId = sender?.userId;
    const isMe = sendId === loginUserId;
    const thumbnailProfileUrl = isMe ? null : sender?.thumbnailProfileUrl;
    const rawTags =
      tag.items.length > 0 ? tag.items.map(t => t) : isMe ? (consumeNextMyTags?.() ?? []) : [];

    const tagIdSeen = new Set<number>();
    const tags = rawTags.filter(t => {
      const id = Number(t.tagId);
      if (tagIdSeen.has(id)) return false;
      tagIdSeen.add(id);
      return true;
    });

    const rawReadUserIds = Array.from(
      new Set((readItems?.items ?? []).map(item => String(item.userId))),
    );

    let readUserIds: string[];
    let notReadCount: number;

    if (participants.length === 0) {
      readUserIds = rawReadUserIds;
      // participants 캐시 미로드 시 totalUserCount로 fallback 계산
      const totalCount = getTotalUserCount();
      notReadCount = totalCount > 0 ? Math.max(0, totalCount - rawReadUserIds.length) : 0;
    } else {
      const participantIds = readCountCalculator.createParticipantIdSet(participants);
      readUserIds = readCountCalculator.filterValidReaders(rawReadUserIds, participantIds);
      notReadCount = readCountCalculator.calculateNotReadCount({ readUserIds, participants });
    }

    let files: MessageFileItem[] | undefined;
    if (
      messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE
    ) {
      const items = (payload as WebSocketMediaFileMessageItemsProps)?.items ?? [];
      files = items.map((it: MessageFileItem) => ({
        path: it.path,
        meta: it.meta,
        presignedUrl: it.presignedUrl,
      }));
    }

    let noticeMessage = '';
    if (messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
      const userList = (payload as WebSocketSubmitInvitePayload)?.userList ?? [];
      noticeMessage = userList.map(user => user.name).join(', ') + '님을 초대했습니다.';
    }

    const text =
      messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT
        ? message?.payload?.content
        : noticeMessage;

    return {
      id: message.id,
      text,
      sender: isMe ? 'me' : 'other',
      name: sender?.name ?? '알 수 없음',
      time: formatKoreanTime(message.createdAt),
      createdAt: message.createdAt,
      thumbnailProfileUrl,
      tags,
      readUserIds,
      notReadCount: notReadCount > 0 ? notReadCount : 0,
      messageContentType,
      files,
      isDeleted: message.isDeleted,
    };
  };
}

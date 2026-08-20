import { readCountCalculator } from '@/features/chat-room/domain';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import {
  Message,
  MessageFileItem,
  WS_MESSAGE_CONTENT_TYPE,
  isSystemMessageContentType,
  WebSocketMediaFileMessageItemsProps,
  WebSocketPublishItem,
  WebSocketReceiveTagProps,
  WebSocketSubmitInvitePayload,
} from '@/shared/types/websocket';
import { UNKNOWN_USER_NAME } from '@/shared/config/constants';
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
    const { item: rawItem } = input;

    // 탈퇴 발신자 익명화 — 서버는 히스토리/PUB sender에 isDeleted=true 플래그만 표시하고
    // 이름은 원본을 유지한다(RN 실측). "알 수 없음" + 기본 이미지의 소급 익명화는 클라이언트
    // 책임이므로, 파싱 최상단에서 sender를 정규화해 이름·EXIT 시스템 문구·미리보기까지 일괄 반영한다.
    const item =
      rawItem.sender?.isDeleted === true
        ? {
            ...rawItem,
            sender: {
              ...rawItem.sender,
              name: UNKNOWN_USER_NAME,
              profileUrl: null,
              profilePresignedUrl: null,
              thumbnailProfileUrl: null,
            },
          }
        : rawItem;
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

    // 발신자 읽음 클램프 — 발신자는 자기 메시지를 항상 읽었다. 신규 방에서 서버 read 등록
    // (VIEW_IN 처리)이 PUB echo의 readItems 반영보다 늦는 타이밍(RN 2026-07-31 서버 로그
    // 실측 15ms 갭)에 안읽음이 전체 인원수로 표시되는 문제를 서버 값에 의존하지 않고 보강한다.
    // 퇴장/탈퇴 발신자는 calculateNotReadCount 내부 필터가 계산 시점에 참여자 기준으로 걸러낸다.
    const senderIdForRead = sendId != null ? String(sendId).trim() : '';
    if (
      senderIdForRead.length > 0 &&
      !isSystemMessageContentType(messageContentType) &&
      !rawReadUserIds.includes(senderIdForRead)
    ) {
      rawReadUserIds.push(senderIdForRead);
    }

    let readUserIds: string[];
    let notReadCount: number;

    if (isSystemMessageContentType(messageContentType)) {
      readUserIds = rawReadUserIds;
      notReadCount = 0;
    } else if (participants.length === 0) {
      readUserIds = rawReadUserIds;
      // participants 캐시 미로드 시 totalUserCount로 fallback 계산
      const totalCount = getTotalUserCount();
      notReadCount = totalCount > 0 ? Math.max(0, totalCount - rawReadUserIds.length) : 0;
    } else {
      // 저장은 원본 보존(읽음 비후퇴 불변식, mergeFetchedReadState §①) — 퇴장자 제외 필터는
      // calculateNotReadCount 내부의 계산 시점에만 적용한다. 신규 방 직후처럼 참여자 스냅샷이
      // 불완전한 순간에 필터 결과를 저장하면 읽음 기록이 복구 불가로 소실된다 (RN 실측 회귀).
      readUserIds = rawReadUserIds;
      notReadCount = readCountCalculator.calculateNotReadCount({
        readUserIds: rawReadUserIds,
        participants,
      });
    }

    // 신고 접수(운영자 승인 전) 마스킹 — 서버는 전용 contentType이 아니라 message.isReported
    // 플래그로 내려주며 payload.content가 이미 마스킹 문구다. 플래그 없는 응답 대비
    // masked media(items 없이 content만) 휴리스틱을 fallback으로 유지 (RN 패리티).
    const isSystemType =
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK;
    const isMediaType =
      messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;
    const rawContent = (payload as { content?: unknown } | null)?.content;
    const maskedMediaContent =
      isMediaType &&
      typeof rawContent === 'string' &&
      ((payload as { items?: unknown[] } | null)?.items?.length ?? 0) === 0
        ? rawContent
        : null;
    const reportedMaskText =
      message.isReported === true && !isSystemType
        ? typeof rawContent === 'string'
          ? rawContent
          : '신고 접수한 메시지예요.'
        : maskedMediaContent;

    if (reportedMaskText !== null) {
      return {
        id: message.id,
        text: reportedMaskText,
        sender: isMe ? 'me' : 'other',
        senderId: message.senderId != null ? String(message.senderId) : undefined,
        name: sender?.name ?? UNKNOWN_USER_NAME,
        time: formatKoreanTime(message.createdAt),
        createdAt: message.createdAt,
        thumbnailProfileUrl,
        tags: [],
        readUserIds,
        notReadCount: notReadCount > 0 ? notReadCount : 0,
        messageContentType: WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK,
        files: undefined,
        isDeleted: message.isDeleted,
      };
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
      const senderName = sender?.name ?? '사용자';
      noticeMessage =
        userList.length > 0
          ? `${senderName}님이 ${userList.map(user => user.name).join(', ')}님을 초대했어요.`
          : `${senderName}님이 대화상대를 초대했어요.`;
    } else if (messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
      noticeMessage = `${sender?.name ?? '사용자'}님이 채팅방을 나갔어요.`;
    } else if (
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE ||
      messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE
    ) {
      noticeMessage = `${sender?.name ?? '사용자'}님이 방 제목을 변경했어요.`;
    } else if (messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE) {
      noticeMessage = `${sender?.name ?? '사용자'}님이 공지를 올렸어요.`;
    } else if (messageContentType === WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK) {
      // 서버가 내려준 마스킹 안내 문구 그대로 (RN 패리티)
      noticeMessage = (payload as { content?: string } | null)?.content ?? '';
    }

    const text =
      messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT
        ? message?.payload?.content
        : noticeMessage;

    return {
      id: message.id,
      text,
      sender: isMe ? 'me' : 'other',
      senderId: message.senderId != null ? String(message.senderId) : undefined,
      name: sender?.name ?? UNKNOWN_USER_NAME,
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

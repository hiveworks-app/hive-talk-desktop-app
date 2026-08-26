import {
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketPublishItem,
  WebSocketSubmitInvitePayload,
} from '@/shared/types/websocket';
import { getBlockedFoldText } from '@/features/block/blockedMessage';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { isBlockedUser } from '@/store/blockedMembersStore';

/**
 * 신고 접수(REPORTED) 마스킹된 미디어 메시지 대응 (RN 패리티).
 * 서버가 messageContentType은 IMAGE/MEDIA/FILE을 유지한 채 payload를
 * `{ content: '신고가 접수된 메시지에요.' }`로 교체해 내려줄 수 있다 (items 없음).
 * @returns 마스킹 안내 문구. 마스킹 형태가 아니면(정상 items 존재) null
 */
export function getMaskedMediaContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('items' in payload && Array.isArray((payload as { items: unknown }).items)) return null;
  const content = (payload as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

export function getLastMessagePreview(lastMessage?: WebSocketPublishItem | null): string {
  if (!lastMessage) return '';

  const { message, sender } = lastMessage;

  // 삭제된 메시지 — 미리보기도 삭제 문구 (차단 접힘보다 우선, 버블 렌더 우선순위와 동일)
  if (message.isDeleted) return IS_DELETE_MESSAGE_COMMENTS;

  // 신고 확정(운영 숨김) 시스템 안내 — updater가 치환한 클라 전용 타입이라 서버 메시지
  // 유니온에 없음 → switch 밖에서 문자열 비교로 처리 (RN 패리티)
  if ((message.messageContentType as string) === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED) {
    return (message.payload as { content?: string } | null)?.content ?? '';
  }

  // 차단 발신자의 마지막 메시지 — 미리보기를 접힘 문구로 대체 (정책 block.md, 본인 차단은 불가하므로 isMe 체크 불필요)
  if (message.senderId != null && isBlockedUser(String(message.senderId))) {
    return getBlockedFoldText(message.messageContentType);
  }

  switch (message.messageContentType) {
    case WS_MESSAGE_CONTENT_TYPE.TEXT:
      return message.payload.content;

    case WS_MESSAGE_CONTENT_TYPE.IMAGE: {
      // 신고 마스킹(payload에 items 없이 content만) 우선 — 미감지 시 items 접근에서 throw (RN 패리티)
      const maskedImage = getMaskedMediaContent(message.payload);
      if (maskedImage !== null) return maskedImage;
      const length = message.payload.items.length;
      return length >= 2 ? `사진 ${length}장을 보냈어요.` : '사진을 보냈어요.';
    }

    case WS_MESSAGE_CONTENT_TYPE.MEDIA:
      return getMaskedMediaContent(message.payload) ?? '동영상을 보냈어요.';

    case WS_MESSAGE_CONTENT_TYPE.FILE:
      return getMaskedMediaContent(message.payload) ?? '파일을 보냈어요.';

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE: {
      const userList = (message.payload as WebSocketSubmitInvitePayload).userList ?? [];
      const senderName = sender?.name || '사용자';
      if (userList.length === 0) return `${senderName}님이 대화상대를 초대했어요.`;
      return `${senderName}님이 ${userList.map(u => u.name).join(', ')}님을 초대했어요.`;
    }

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT: {
      return `${sender?.name || '사용자'}님이 채팅방을 나갔어요.`;
    }

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE:
    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE: {
      return `${sender?.name ?? '사용자'}님이 방 제목을 변경했어요.`;
    }

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE: {
      return `${sender?.name || '사용자'}님이 공지를 올렸어요.`;
    }

    // 신고 접수 마스킹 — 서버 안내 문구 그대로 (RN 패리티, SYSTEM_REPORTED는 클라 치환 타입이라 서버 메시지 유니온에 없음)
    case WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK: {
      return (message.payload as { content?: string } | null)?.content ?? '';
    }

    default:
      return '';
  }
}

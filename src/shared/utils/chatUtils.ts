import {
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketPublishItem,
  WebSocketSubmitInvitePayload,
} from '@/shared/types/websocket';
import { getBlockedFoldText } from '@/features/block/blockedMessage';
import { isBlockedUser } from '@/store/blockedMembersStore';

export function getLastMessagePreview(lastMessage?: WebSocketPublishItem | null): string {
  if (!lastMessage) return '';

  const { message, sender } = lastMessage;

  // 차단 발신자의 마지막 메시지 — 미리보기를 접힘 문구로 대체 (정책 block.md, 본인 차단은 불가하므로 isMe 체크 불필요)
  if (message.senderId != null && isBlockedUser(String(message.senderId))) {
    return getBlockedFoldText(message.messageContentType);
  }

  switch (message.messageContentType) {
    case WS_MESSAGE_CONTENT_TYPE.TEXT:
      return message.payload.content;

    case WS_MESSAGE_CONTENT_TYPE.IMAGE: {
      const length = message.payload.items.length;
      return length >= 2 ? `사진 ${length}장을 보냈어요.` : '사진을 보냈어요.';
    }

    case WS_MESSAGE_CONTENT_TYPE.MEDIA:
      return '동영상을 보냈어요.';

    case WS_MESSAGE_CONTENT_TYPE.FILE:
      return '파일을 보냈어요.';

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

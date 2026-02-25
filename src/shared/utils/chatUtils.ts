import {
  WS_MESSAGE_CONTENT_TYPE,
  WebSocketPublishItem,
  WebSocketSubmitInvitePayload,
} from '@/shared/types/websocket';

export function getLastMessagePreview(lastMessage?: WebSocketPublishItem | null): string {
  if (!lastMessage) return '';

  const { message, sender } = lastMessage;

  switch (message.messageContentType) {
    case WS_MESSAGE_CONTENT_TYPE.TEXT:
      return message.payload.content;

    case WS_MESSAGE_CONTENT_TYPE.IMAGE: {
      const length = message.payload.items.length;
      return length === 1 ? '사진을 보냈습니다.' : `사진을 ${length}장 보냈습니다.`;
    }

    case WS_MESSAGE_CONTENT_TYPE.MEDIA:
      return '동영상을 보냈습니다.';

    case WS_MESSAGE_CONTENT_TYPE.FILE:
      return '파일을 보냈습니다.';

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE: {
      const userList = (message.payload as WebSocketSubmitInvitePayload).userList ?? [];
      if (userList.length === 0) return '초대했습니다.';
      if (userList.length === 1) return `${userList[0].name}님을 초대했습니다.`;
      return `${userList[0].name} 외 ${userList.length - 1}명을 초대했습니다.`;
    }

    case WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT: {
      return sender?.name + '님이 방을 나갔습니다.';
    }

    default:
      return '';
  }
}

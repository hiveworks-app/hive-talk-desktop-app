'use client';

import { useEffect, useRef } from 'react';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

/**
 * WebSocket 연결이 true → false로 전환되면
 * 전송 중인 로컬 텍스트 메시지를 즉시 'failed' 처리하고
 * pending queue에서도 제거한다.
 */
export function useLocalMessageFailureDetector(
  isConnected: boolean,
  removePendingPublish: (content: string) => void,
) {
  const prevRef = useRef(isConnected);

  useEffect(() => {
    if (prevRef.current && !isConnected) {
      const { messages, patchMessageById } = useChatRoomRuntimeStore.getState();
      messages.forEach(msg => {
        if (
          msg.isLocal &&
          msg.localStatus === 'uploading' &&
          msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT
        ) {
          if (msg.retryPayload?.content) {
            removePendingPublish(msg.retryPayload.content);
          }
          patchMessageById(msg.id, { localStatus: 'failed' });
        }
      });
    }
    prevRef.current = isConnected;
  }, [isConnected, removePendingPublish]);
}

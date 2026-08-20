'use client';

import { useEffect, useRef } from 'react';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';

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
      const { messages, currentRoomId, patchMessageById } = useChatRoomRuntimeStore.getState();
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
          // 실패 메시지 영속화 — 방 이탈/재실행 후 복원 + 목록 느낌표 판정 소스 (RN 패리티)
          const failedRoomId = msg.retryPayload?.roomId || currentRoomId;
          if (failedRoomId) {
            useFailedMessagesStore.getState().saveFailed(failedRoomId, { ...msg, localStatus: 'failed' });
          }
        }
      });
    }
    prevRef.current = isConnected;
  }, [isConnected, removePendingPublish]);
}

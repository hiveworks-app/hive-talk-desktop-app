'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import {
  DM_ROOM_LIST_KEY,
  EM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
} from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';
import { useUIStore } from '@/store/uiStore';
import { setLastCompanyChatChip } from '@/widgets/chat-room-list/ChatRoomListSidebar';

/**
 * 채팅방 목록 개별 나가기 (RN SwipeableChatListItem onLeave 대응 — 데스크톱은 hover 액션).
 * 일괄 나가기(ChatRoomManage*)와 동일한 정리 규칙: 드래프트·실패 메시지·보류 READ 제거 +
 * 목록 캐시 낙관적 제거 + 열려 있던 방이면 목록으로 라우팅 이탈.
 */
export function useLeaveRoom() {
  const { send } = useAppWebSocket();
  const queryClient = useQueryClient();
  const router = useAppRouter();
  const params = useParams();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const dmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.DIRECT_MESSAGE, channelId: '' });
  const gmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.GROUP_MESSAGE, channelId: '' });
  const emBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE, channelId: '' });

  const leaveRoom = useCallback(
    (roomId: string, channelType: WebSocketChannelTypes, options?: { silent?: boolean }) => {
      if (!roomId || isOffline()) return;

      const builder =
        channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE
          ? gmBuilder
          : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
            ? emBuilder
            : dmBuilder;
      send(builder.buildExitMessageRoom({ channelIdOverride: roomId }));

      // 나간 방의 드래프트·실패 메시지·보류 READ 정리 (RN 패리티)
      useDraftStore.getState().clearDraft(roomId);
      useFailedMessagesStore.getState().removeRoom(roomId);
      pendingReadRegistry.removeRoom(roomId);

      // 내가 나갈 땐 WS가 목록을 갱신하지 않으므로 캐시에서 낙관적 제거
      const listKey =
        channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE
          ? GM_ROOM_LIST_KEY
          : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
            ? EM_ROOM_LIST_KEY
            : DM_ROOM_LIST_KEY;
      queryClient.setQueryData<GetChatRoomListItemType[]>(listKey, prev =>
        prev?.filter(r => r.roomModel.roomId !== roomId) ?? [],
      );

      // 그 방을 띄운 팝업 창 정리 — EXIT ack relay에 의존하지 않는 명시적 닫기 (Electron 아니면 no-op)
      (window as unknown as { electronAPI?: { closeChatWindow?: (id: string) => void } })
        .electronAPI?.closeChatWindow?.(roomId);

      // 열려 있던 방이면 목록으로 이탈 — 복귀 칩을 방 종류에 맞춘다 (RN 패리티:
      // GM 방을 나갔는데 '1:1 채팅' 칩이 유지된 화면으로 복귀하는 것 방지)
      const openRoomId = typeof params?.roomId === 'string' ? params.roomId : undefined;
      if (openRoomId === roomId) {
        if (channelType !== WS_CHANNEL_TYPE.EXTERNAL_MESSAGE) {
          setLastCompanyChatChip(channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE ? 'dm' : 'gm');
        }
        router.push(channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? '/external-chat' : '/chat');
      }

      // silent: 자동 정리(빈 방 등)처럼 사용자가 직접 '나가기'를 누르지 않은 경우 스낵바 생략
      if (!options?.silent) showSnackbar({ message: '채팅방을 나갔어요.', state: 'success' });
    },
    [send, dmBuilder, gmBuilder, emBuilder, queryClient, params, router, showSnackbar],
  );

  return { leaveRoom };
}

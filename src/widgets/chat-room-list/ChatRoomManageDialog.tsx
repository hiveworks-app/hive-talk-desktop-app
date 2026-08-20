'use client';

import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/auth/authStore';
import { ChatRoomManageOverlay, type ManageRoomEntry } from './ChatRoomManageOverlay';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';

interface ChatRoomManageDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 협력채팅(EM) 채팅방 관리 모달 — 공용 오버레이에 EM 데이터/나가기 로직 주입.
 */
export function ChatRoomManageDialog({ open, onClose }: ChatRoomManageDialogProps) {
  const { data: emRooms = [] } = useGetEMRoomList();
  const myUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { send } = useAppWebSocket();
  const emBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE, channelId: '' });

  const rooms: ManageRoomEntry[] = emRooms.map(room => {
    const others = (room.roomModel.participants ?? [])
      .filter(p => String(p.userId) !== String(myUserId))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return {
      roomId: room.roomModel.roomId,
      displayName: room.roomModel.title || others.map(p => p.name).join(', ') || '채팅방',
      avatarUsers: others.slice(0, 4).map(p => ({ name: p.name, storageKey: p.thumbnailProfileUrl })),
      preview: getLastMessagePreview(room.messageList[0] ?? null),
    };
  });

  const handleLeave = (ids: string[]) => {
    ids.forEach(roomId => {
      send(emBuilder.buildExitMessageRoom({ channelIdOverride: roomId }));
      // 나간 방의 드래프트·실패 메시지 정리 (RN 패리티)
      useDraftStore.getState().clearDraft(roomId);
      useFailedMessagesStore.getState().removeRoom(roomId);
    });

    // 내가 나갈 땐 WS가 목록을 갱신하지 않으므로 캐시에서 낙관적 제거
    const sel = new Set(ids);
    queryClient.setQueryData<GetChatRoomListItemType[]>(
      EM_ROOM_LIST_KEY,
      prev => prev?.filter(r => !sel.has(r.roomModel.roomId)) ?? [],
    );

    const openRoomId = typeof params?.roomId === 'string' ? params.roomId : undefined;
    if (openRoomId && sel.has(openRoomId)) router.push('/external-chat');

    showSnackbar({ message: `${ids.length}개 채팅방을 나갔어요.`, state: 'success' });
  };

  return (
    <ChatRoomManageOverlay
      open={open}
      onClose={onClose}
      rooms={rooms}
      onLeave={handleLeave}
      leaveNotice="나가면 다시 초대받아야 입장할 수 있어요."
    />
  );
}

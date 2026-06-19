'use client';

import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useGetDMRoomList, useGetGMRoomList } from '@/features/chat-room-list/queries';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import type { GroupAvatarUser } from '@/shared/ui/GroupProfileAvatar';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/auth/authStore';
import { ChatRoomManageOverlay, type ManageRoomEntry } from './ChatRoomManageOverlay';

interface CompanyChatManageDialogProps {
  open: boolean;
  onClose: () => void;
}

const lastActivityMs = (room: GetChatRoomListItemType) =>
  Date.parse(room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? '') || 0;

/**
 * 사내채팅(DM/GM) 채팅방 관리 모달 — 공용 오버레이에 DM+GM 데이터/나가기 로직 주입.
 * DM=상대방 단일 아바타, GM=참여자 그룹 아바타. 나가기는 방마다 채널타입에 맞는 빌더로 EXIT.
 */
export function CompanyChatManageDialog({ open, onClose }: CompanyChatManageDialogProps) {
  const { data: dmRooms = [] } = useGetDMRoomList();
  const { data: gmRooms = [] } = useGetGMRoomList();
  const myUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { send } = useAppWebSocket();
  // 나가기 메시지는 채널타입이 빌더에 고정 → DM/GM 각각의 빌더 필요 (혼재 일괄 나가기)
  const dmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.DIRECT_MESSAGE, channelId: '' });
  const gmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.GROUP_MESSAGE, channelId: '' });

  // DM/GM 합쳐 최신순 — 목록과 동일 정렬
  const tagged = [
    ...dmRooms.map(room => ({ room, isDM: true })),
    ...gmRooms.map(room => ({ room, isDM: false })),
  ].sort((a, b) => lastActivityMs(b.room) - lastActivityMs(a.room));

  const rooms: ManageRoomEntry[] = tagged.map(({ room, isDM }) => {
    const { roomModel } = room;
    let avatarUsers: GroupAvatarUser[];
    if (isDM) {
      const d = roomModel.participantDetail;
      avatarUsers = d ? [{ name: d.name, storageKey: d.thumbnailProfileUrl }] : [];
    } else {
      avatarUsers = (roomModel.participants ?? [])
        .filter(p => String(p.userId) !== String(myUserId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .slice(0, 4)
        .map(p => ({ name: p.name, storageKey: p.thumbnailProfileUrl }));
    }
    const displayName =
      roomModel.title ||
      roomModel.participantDetail?.name ||
      roomModel.participants?.map(p => p.name).join(', ') ||
      '채팅방';
    return {
      roomId: roomModel.roomId,
      displayName,
      avatarUsers,
      preview: getLastMessagePreview(room.messageList[0] ?? null),
    };
  });

  const handleLeave = (ids: string[]) => {
    const isDMRoom = (id: string) => dmRooms.some(r => r.roomModel.roomId === id);
    ids.forEach(roomId => {
      const builder = isDMRoom(roomId) ? dmBuilder : gmBuilder;
      send(builder.buildExitMessageRoom({ channelIdOverride: roomId }));
    });

    // 내가 나갈 땐 WS가 목록을 갱신하지 않으므로 DM/GM 캐시에서 낙관적 제거
    const sel = new Set(ids);
    const removeLeft = (prev?: GetChatRoomListItemType[]) =>
      prev?.filter(r => !sel.has(r.roomModel.roomId)) ?? [];
    queryClient.setQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY, removeLeft);
    queryClient.setQueryData<GetChatRoomListItemType[]>(GM_ROOM_LIST_KEY, removeLeft);

    const openRoomId = typeof params?.roomId === 'string' ? params.roomId : undefined;
    if (openRoomId && sel.has(openRoomId)) router.push('/chat');

    showSnackbar({ message: `${ids.length}개 채팅방을 나갔어요.`, state: 'success' });
  };

  return <ChatRoomManageOverlay open={open} onClose={onClose} rooms={rooms} onLeave={handleLeave} />;
}

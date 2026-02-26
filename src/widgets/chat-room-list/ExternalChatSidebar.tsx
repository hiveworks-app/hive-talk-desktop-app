'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetEMLastMessage } from '@/features/chat-room/api';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { EM_LAST_MESSAGE_KEY } from '@/shared/config/queryKeys';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { formatChatTimestamp } from '@/shared/utils/formatTimeUtils';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

export function ExternalChatSidebar() {
  const { data: emRooms = [], isLoading } = useGetEMRoomList();

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-surface">
      <div className="electron-drag flex items-center justify-between border-b border-divider px-4 pt-4 pb-3">
        <h2 className="text-heading-md font-bold text-text-primary">협력채팅</h2>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sub text-text-tertiary">로딩 중...</p>
          </div>
        ) : emRooms.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sub text-text-tertiary">채팅방이 없습니다</p>
          </div>
        ) : (
          emRooms.map(room => (
            <EMRoomItem key={room.roomModel.roomId} room={room} />
          ))
        )}
      </div>
    </aside>
  );
}

function EMRoomItem({ room }: { room: GetChatRoomListItemType }) {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { roomModel, messageList, notReadCount } = room;
  const lastMessage = messageList[0] ?? null;
  const preview = getLastMessagePreview(lastMessage);
  const time = lastMessage?.message.createdAt
    ? formatChatTimestamp(lastMessage.message.createdAt)
    : '';

  const displayName =
    roomModel.title ||
    roomModel.participantDetail?.name ||
    roomModel.participants?.map(p => p.name).join(', ') ||
    '채팅방';

  const isActive = params?.roomId === roomModel.roomId;

  const handleClick = async () => {
    if (isActive) return;

    const lastMsg = lastMessage ?? await queryClient
      .fetchQuery({
        queryKey: EM_LAST_MESSAGE_KEY(roomModel.roomId),
        queryFn: () => apiGetEMLastMessage(roomModel.roomId).then(r => r.payload),
        staleTime: 1000 * 60 * 5,
      })
      .catch(() => null);

    const totalUserCount = roomModel.participants?.length ?? 2;

    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: roomModel.roomId,
      roomName: displayName,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount,
      otherUserIsExit: roomModel.participantDetail?.isExit ?? false,
      lastMessage: lastMsg ?? null,
    });

    router.push(`/external-chat/${roomModel.roomId}`);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-150',
        isActive && 'bg-gray-150',
      )}
    >
      <ProfileCircle name={displayName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sub font-medium text-text-primary">{displayName}</span>
          <span className="ml-2 shrink-0 text-sub-sm text-text-tertiary">{time}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-sub-sm text-text-secondary">{preview}</span>
          <Badge count={notReadCount} className="ml-2 shrink-0" />
        </div>
      </div>
    </button>
  );
}

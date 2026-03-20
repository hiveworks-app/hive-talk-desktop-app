"use client";

import { useParams } from "next/navigation";
import { useAppRouter } from "@/shared/hooks/useAppRouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiGetDMLastMessage,
  apiGetGMLastMessage,
} from "@/features/chat-room/api";
import { GetChatRoomListItemType } from "@/features/chat-room-list/type";
import {
  DM_LAST_MESSAGE_KEY,
  GM_LAST_MESSAGE_KEY,
} from "@/shared/config/queryKeys";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/Badge";
import { ProfileCircle } from "@/shared/ui/ProfileCircle";
import {
  WS_CHANNEL_TYPE,
  WebSocketChannelTypes,
} from "@/shared/types/websocket";
import { getLastMessagePreview } from "@/shared/utils/chatUtils";
import { formatChatTimestamp } from "@/shared/utils/formatTimeUtils";
import { useChatRoomInfo } from "@/store/chat/chatRoomStore";

interface ChatRoomItemProps {
  room: GetChatRoomListItemType;
  channelType: WebSocketChannelTypes;
}

export function ChatRoomItem({ room, channelType }: ChatRoomItemProps) {
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { roomModel, messageList, notReadCount } = room;
  const lastMessage = messageList[0] ?? null;
  const preview = getLastMessagePreview(lastMessage);
  const time = lastMessage?.message.createdAt
    ? formatChatTimestamp(lastMessage.message.createdAt)
    : "";

  const displayName =
    roomModel.title ||
    roomModel.participantDetail?.name ||
    roomModel.participants?.map((p) => p.name).join(", ") ||
    "채팅방";

  const profileStorageKey =
    roomModel.participantDetail?.thumbnailProfileUrl ?? null;

  const isActive = params?.roomId === roomModel.roomId;

  const handleClick = async () => {
    if (isActive) return;

    const lastMessageQueryKey =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? DM_LAST_MESSAGE_KEY(roomModel.roomId)
        : GM_LAST_MESSAGE_KEY(roomModel.roomId);

    const lastMessageApi =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? apiGetDMLastMessage
        : apiGetGMLastMessage;

    const lastMsg =
      lastMessage ??
      (await queryClient
        .fetchQuery({
          queryKey: lastMessageQueryKey,
          queryFn: () =>
            lastMessageApi(roomModel.roomId).then((r) => r.payload),
          staleTime: 1000 * 60 * 5,
        })
        .catch(() => null));

    const totalUserCount = roomModel.participants?.length ?? 2;
    const isOtherUserExit = roomModel.participantDetail?.isExit ?? false;

    const invitedUserIds =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE &&
      isOtherUserExit &&
      roomModel.participantDetail?.userId
        ? [String(roomModel.participantDetail.userId)]
        : [];

    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: roomModel.roomId,
      roomName: displayName,
      channelType,
      totalUserCount,
      otherUserIsExit: isOtherUserExit,
      lastMessage: lastMsg ?? null,
      invitedUserIds,
      initialNotReadCount: notReadCount,
    });

    router.push(`/chat/${roomModel.roomId}`);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-150",
        isActive && "bg-gray-150",
      )}
    >
      {/* 아바타 */}
      <ProfileCircle name={displayName} size="md" storageKey={profileStorageKey} />

      {/* 컨텐츠 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sub font-medium text-text-primary">
            {displayName}
          </span>
          <span className="ml-2 shrink-0 text-sub-sm text-text-tertiary">
            {time}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-sub-sm text-text-secondary">
            {preview}
          </span>
          <Badge count={notReadCount} className="ml-2 shrink-0" />
        </div>
      </div>
    </button>
  );
}

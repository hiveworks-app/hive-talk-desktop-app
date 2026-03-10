"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiGetDMLastMessage,
  apiGetGMLastMessage,
} from "@/features/chat-room/api";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
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
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";

type Tab = "dm" | "gm";

export function ChatRoomListSidebar() {
  const [activeTab, setActiveTab] = useState<Tab>("dm");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const { data: dmRooms = [], isLoading: dmLoading } = useGetDMRoomList();
  const { data: gmRooms = [], isLoading: gmLoading } = useGetGMRoomList();

  const rooms = activeTab === "dm" ? dmRooms : gmRooms;
  const isLoading = activeTab === "dm" ? dmLoading : gmLoading;

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-surface">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) */}
      <div className="electron-drag flex items-center justify-between border-b border-divider px-4 pt-4 pb-3">
        <h2 className="text-heading-md font-bold text-text-primary">채팅</h2>
        <div className="electron-no-drag flex items-center gap-2">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-pressed"
            title="새 채팅방"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-divider">
        {(["dm", "gm"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 text-sub font-medium transition-colors",
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {tab === "dm" ? "1:1" : "그룹"}
          </button>
        ))}
      </div>

      <CreateRoomDialog
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
      />

      {/* 목록 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sub text-text-tertiary">로딩 중...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sub text-text-tertiary">채팅방이 없습니다</p>
          </div>
        ) : (
          rooms.map((room) => (
            <ChatRoomItem
              key={room.roomModel.roomId}
              room={room}
              channelType={
                activeTab === "dm"
                  ? WS_CHANNEL_TYPE.DIRECT_MESSAGE
                  : WS_CHANNEL_TYPE.GROUP_MESSAGE
              }
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ChatRoomItem({
  room,
  channelType,
}: {
  room: GetChatRoomListItemType;
  channelType: WebSocketChannelTypes;
}) {
  const router = useRouter();
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

  const isActive = params?.roomId === roomModel.roomId;

  const handleClick = async () => {
    if (isActive) return;

    // 마지막 메시지 조회 (캐시 우선)
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

    // DM + 상대 나감: invitedUserIds 설정 → 메시지 전송 시 INVITE 발동 (모바일 패턴)
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
      <ProfileCircle name={displayName} size="md" />

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

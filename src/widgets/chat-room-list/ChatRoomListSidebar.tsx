"use client";

import { useMemo, useState } from "react";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
import type { GetChatRoomListItemType } from "@/features/chat-room-list/type";
import { WS_CHANNEL_TYPE } from "@/shared/types/websocket";
import type { WebSocketChannelTypes } from "@/shared/types/websocket";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/EmptyState";
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";
import { ChatRoomItem } from "./ChatRoomItem";

const CHIPS = [
  { key: "all", label: "전체" },
  { key: "dm", label: "1:1 채팅" },
  { key: "gm", label: "그룹채팅" },
] as const;

type ChatChip = (typeof CHIPS)[number]["key"];

type TaggedRoom = {
  room: GetChatRoomListItemType;
  channelType: WebSocketChannelTypes;
};

/** 최신 메시지 시각(ms). 메시지 없으면 방 생성 시각으로 폴백. */
const lastActivityMs = (room: GetChatRoomListItemType) =>
  Date.parse(
    room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? "",
  ) || 0;

export function ChatRoomListSidebar() {
  const [activeChip, setActiveChip] = useState<ChatChip>("all");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const { data: dmRooms = [], isLoading: dmLoading } = useGetDMRoomList();
  const { data: gmRooms = [], isLoading: gmLoading } = useGetGMRoomList();

  // 각 방에 채널 타입을 태깅 — '전체'에서 DM/GM이 섞여도 클릭 라우팅/렌더가 정확하도록.
  const visibleRooms = useMemo<TaggedRoom[]>(() => {
    const dmTagged: TaggedRoom[] = dmRooms.map((room) => ({
      room,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
    }));
    const gmTagged: TaggedRoom[] = gmRooms.map((room) => ({
      room,
      channelType: WS_CHANNEL_TYPE.GROUP_MESSAGE,
    }));
    if (activeChip === "dm") return dmTagged;
    if (activeChip === "gm") return gmTagged;
    // 전체: DM+GM 합쳐 최신 메시지순 정렬
    return [...dmTagged, ...gmTagged].sort(
      (a, b) => lastActivityMs(b.room) - lastActivityMs(a.room),
    );
  }, [dmRooms, gmRooms, activeChip]);

  const isLoading =
    activeChip === "dm"
      ? dmLoading
      : activeChip === "gm"
        ? gmLoading
        : dmLoading || gmLoading;

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-surface">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) */}
      <div className="electron-drag flex items-center justify-between border-b border-divider px-4 pt-4 pb-3">
        <h2 className="text-heading-lg font-semibold text-text-primary">사내채팅</h2>
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

      {/* 필터 칩 (전체 / 1:1 채팅 / 그룹채팅) */}
      <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-2">
        {CHIPS.map((chip) => (
          <Chip
            key={chip.key}
            label={chip.label}
            active={activeChip === chip.key}
            onClick={() => setActiveChip(chip.key)}
          />
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
        ) : visibleRooms.length === 0 ? (
          <EmptyState message="아직 채팅방이 없어요." className="py-10" />
        ) : (
          visibleRooms.map(({ room, channelType }) => (
            <ChatRoomItem
              key={room.roomModel.roomId}
              room={room}
              channelType={channelType}
            />
          ))
        )}
      </div>
    </aside>
  );
}

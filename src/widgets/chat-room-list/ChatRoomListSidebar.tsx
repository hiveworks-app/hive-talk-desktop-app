"use client";

import { useState } from "react";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
import { cn } from "@/shared/lib/cn";
import { WS_CHANNEL_TYPE } from "@/shared/types/websocket";
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";
import { ChatRoomItem } from "./ChatRoomItem";

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

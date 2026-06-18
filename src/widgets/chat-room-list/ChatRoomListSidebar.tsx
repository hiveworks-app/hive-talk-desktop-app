"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
import type { GetChatRoomListItemType } from "@/features/chat-room-list/type";
import { cn } from "@/shared/lib/cn";
import { WS_CHANNEL_TYPE } from "@/shared/types/websocket";
import type { WebSocketChannelTypes } from "@/shared/types/websocket";
import { filterByhangeulSearch } from "@/shared/utils/hangeulSearch";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/EmptyState";
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";
import IconCreateChatFilled from "@assets/icons/create-chat-filled.svg";
import IconSearchDefault from "@assets/icons/search-default.svg";
import IconCloseStroke from "@assets/icons/close-stroke.svg";
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

/** 검색 대상 텍스트: 채팅방 이름 + 상대방 이름 (정책 chat.md). */
const roomSearchText = (room: GetChatRoomListItemType) => {
  const { title, participantDetail, participants } = room.roomModel;
  return [
    title,
    participantDetail?.name,
    ...(participants?.map((p) => p.name) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
};

export function ChatRoomListSidebar() {
  const [activeChip, setActiveChip] = useState<ChatChip>("all");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: dmRooms = [], isLoading: dmLoading } = useGetDMRoomList();
  const { data: gmRooms = [], isLoading: gmLoading } = useGetGMRoomList();

  // 검색창 열릴 때 자동 포커스
  useEffect(() => {
    if (isSearchOpen) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchOpen]);

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
    const base =
      activeChip === "dm"
        ? dmTagged
        : activeChip === "gm"
          ? gmTagged
          : // 전체: DM+GM 합쳐 최신 메시지순 정렬
            [...dmTagged, ...gmTagged].sort(
              (a, b) => lastActivityMs(b.room) - lastActivityMs(a.room),
            );
    // 채팅방명/상대방 이름 부분일치(한글 초성 포함) — 멤버목록 검색과 동일
    return filterByhangeulSearch(base, search, ({ room }) => roomSearchText(room));
  }, [dmRooms, gmRooms, activeChip, search]);

  const isLoading =
    activeChip === "dm"
      ? dmLoading
      : activeChip === "gm"
        ? gmLoading
        : dmLoading || gmLoading;

  const isSearching = search.trim().length > 0;

  // 검색 토글: 닫을 때 검색어를 비워 "보이지 않는 필터"가 남지 않도록 한다.
  const toggleSearch = () => {
    if (isSearchOpen) {
      setSearch("");
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
    }
  };
  const closeSearch = () => {
    setSearch("");
    setIsSearchOpen(false);
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-surface">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) */}
      <div className="electron-drag flex items-center justify-between border-b border-divider px-4 pt-4 pb-3">
        <h2 className="text-heading-lg font-semibold text-text-primary">사내채팅</h2>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={toggleSearch}
            title="검색"
            aria-label="채팅 검색"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
          >
            <IconSearchDefault width={20} height={20} />
          </button>
          <button
            onClick={() => setShowCreateRoom(true)}
            title="새 채팅"
            aria-label="새 채팅"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
          >
            <IconCreateChatFilled width={20} height={20} />
          </button>
        </div>
      </div>

      {/* 검색바 (멤버목록과 동일한 인라인 토글) */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isSearchOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-b border-divider bg-gray-100 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
                placeholder="채팅방명 또는 상대방 이름 검색"
                className="min-w-0 flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
              />
              <button
                onClick={closeSearch}
                aria-label="검색 닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-gray-200"
              >
                <IconCloseStroke width={20} height={20} />
              </button>
            </div>
          </div>
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
          <EmptyState
            message={isSearching ? "검색 결과가 없어요." : "아직 채팅방이 없어요."}
            className="py-10"
          />
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

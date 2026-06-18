"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
import { useGetPinnedMembers } from "@/features/pinned-members/queries";
import type { GetChatRoomListItemType } from "@/features/chat-room-list/type";
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from "@/shared/config/queryKeys";
import { useAppRouter } from "@/shared/hooks/useAppRouter";
import { cn } from "@/shared/lib/cn";
import { WS_CHANNEL_TYPE } from "@/shared/types/websocket";
import type { WebSocketChannelTypes } from "@/shared/types/websocket";
import { isOffline } from "@/shared/utils/offlineGuard";
import { filterByhangeulSearch } from "@/shared/utils/hangeulSearch";
import { useAppWebSocket } from "@/shared/websocket/WebSocketContext";
import { useWebSocketMessageBuilder } from "@/shared/websocket/useWebSocketMessageBuilder";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useUIStore } from "@/store/uiStore";
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";
import IconCreateChatFilled from "@assets/icons/create-chat-filled.svg";
import IconSearchDefault from "@assets/icons/search-default.svg";
import IconCloseStroke from "@assets/icons/close-stroke.svg";
import { ChatRoomItem } from "./ChatRoomItem";
import { ChatSettingsMenu, type ChatSortType } from "./ChatSettingsMenu";

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

const NO_PIN_RANK = Number.POSITIVE_INFINITY;

/**
 * 방의 "관심멤버 rank"(작을수록 위) — 멤버목록 등록 순서 기준.
 * DM=상대방 rank, GM=참여자 중 최소 rank, 관심멤버 없으면 Infinity. (RN sortRooms 패리티, 정책 chat.md:38)
 */
const roomFavoriteRank = (
  { room, channelType }: TaggedRoom,
  rankMap: Map<string, number>,
): number => {
  if (channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE) {
    const userId = room.roomModel.participantDetail?.userId;
    return userId ? rankMap.get(userId) ?? NO_PIN_RANK : NO_PIN_RANK;
  }
  let min = NO_PIN_RANK;
  for (const p of room.roomModel.participants ?? []) {
    const rank = rankMap.get(p.userId);
    if (rank !== undefined && rank < min) min = rank;
  }
  return min;
};

export function ChatRoomListSidebar() {
  const [activeChip, setActiveChip] = useState<ChatChip>("all");
  const [sortType, setSortType] = useState<ChatSortType>("latest");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: dmRooms = [], isLoading: dmLoading } = useGetDMRoomList();
  const { data: gmRooms = [], isLoading: gmLoading } = useGetGMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const showSnackbar = useUIStore((s) => s.showSnackbar);
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { send } = useAppWebSocket();
  // 나가기 메시지는 채널타입이 빌더에 고정 → DM/GM 각각의 빌더가 필요 (혼재 일괄 나가기)
  const dmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.DIRECT_MESSAGE, channelId: "" });
  const gmBuilder = useWebSocketMessageBuilder({ type: WS_CHANNEL_TYPE.GROUP_MESSAGE, channelId: "" });

  // 검색창 열릴 때 자동 포커스
  useEffect(() => {
    if (isSearchOpen) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchOpen]);

  // 관심멤버 userId → 등록 순서 rank (관심멤버 순 정렬용)
  const pinnedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    pinnedMembers.forEach((m, i) => map.set(String(m.userId), i));
    return map;
  }, [pinnedMembers]);

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
      activeChip === "dm" ? dmTagged : activeChip === "gm" ? gmTagged : [...dmTagged, ...gmTagged];

    // 정렬: 관심멤버 순이면 rank 우선(동률은 최신순), 아니면 최신메시지 순
    const sorted = [...base].sort((a, b) => {
      if (sortType === "favorite") {
        const ra = roomFavoriteRank(a, pinnedRankMap);
        const rb = roomFavoriteRank(b, pinnedRankMap);
        if (ra !== rb) return ra - rb;
      }
      return lastActivityMs(b.room) - lastActivityMs(a.room);
    });

    // 채팅방명/상대방 이름 부분일치(한글 초성 포함) — 멤버목록 검색과 동일
    return filterByhangeulSearch(sorted, search, ({ room }) => roomSearchText(room));
  }, [dmRooms, gmRooms, activeChip, sortType, pinnedRankMap, search]);

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

  // ── 채팅방 관리(복수 선택 나가기) ── (정책 chat.md:52)
  const enterManageMode = () => {
    setSearch("");
    setIsSearchOpen(false);
    setSelectedRoomIds(new Set());
    setIsManageMode(true);
  };
  const exitManageMode = () => {
    setIsManageMode(false);
    setSelectedRoomIds(new Set());
  };
  const toggleRoomSelect = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };
  const handleBulkLeave = () => {
    const ids = [...selectedRoomIds];
    if (ids.length === 0 || isOffline()) return;
    if (!window.confirm(`${ids.length}개의 채팅방을 나가겠어요?`)) return;

    // 방마다 채널타입에 맞는 빌더로 EXIT 전송
    const channelOf = (id: string) =>
      dmRooms.some((r) => r.roomModel.roomId === id)
        ? WS_CHANNEL_TYPE.DIRECT_MESSAGE
        : WS_CHANNEL_TYPE.GROUP_MESSAGE;
    ids.forEach((roomId) => {
      const builder = channelOf(roomId) === WS_CHANNEL_TYPE.DIRECT_MESSAGE ? dmBuilder : gmBuilder;
      send(builder.buildExitMessageRoom({ channelIdOverride: roomId }));
    });

    // 내가 나갈 땐 WS가 목록을 갱신하지 않으므로 캐시에서 낙관적 제거
    const sel = new Set(ids);
    const removeLeft = (prev?: GetChatRoomListItemType[]) =>
      prev?.filter((r) => !sel.has(r.roomModel.roomId)) ?? [];
    queryClient.setQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY, removeLeft);
    queryClient.setQueryData<GetChatRoomListItemType[]>(GM_ROOM_LIST_KEY, removeLeft);

    // 현재 열려있는 방을 나갔으면 채팅 목록으로 이동
    const openRoomId = typeof params?.roomId === "string" ? params.roomId : undefined;
    if (openRoomId && sel.has(openRoomId)) router.push("/chat");

    showSnackbar({ message: `${ids.length}개 채팅방을 나갔어요.`, state: "success" });
    exitManageMode();
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
          <ChatSettingsMenu
            sortType={sortType}
            onSortChange={setSortType}
            onManageRooms={enterManageMode}
          />
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

      {/* 관리 모드: 취소 + 선택 개수 / 일반: 필터 칩 */}
      {isManageMode ? (
        <div className="flex items-center justify-between border-b border-divider px-4 py-2.5">
          <button onClick={exitManageMode} className="text-sub font-medium text-text-secondary hover:text-text-primary">
            취소
          </button>
          <span className="text-sub-sm text-text-tertiary">{selectedRoomIds.size}개 선택</span>
        </div>
      ) : (
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
      )}

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
              selectionMode={isManageMode}
              selected={selectedRoomIds.has(room.roomModel.roomId)}
              onToggleSelect={() => toggleRoomSelect(room.roomModel.roomId)}
            />
          ))
        )}
      </div>

      {/* 관리 모드 하단 액션: 선택한 방 일괄 나가기 */}
      {isManageMode && (
        <div className="border-t border-divider p-3">
          <button
            onClick={handleBulkLeave}
            disabled={selectedRoomIds.size === 0}
            className="w-full rounded-lg bg-state-error py-2.5 text-sub font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            나가기{selectedRoomIds.size > 0 ? ` (${selectedRoomIds.size})` : ""}
          </button>
        </div>
      )}
    </aside>
  );
}

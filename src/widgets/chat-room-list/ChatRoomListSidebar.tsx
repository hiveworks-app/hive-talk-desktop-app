"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useGetDMRoomList,
  useGetGMRoomList,
} from "@/features/chat-room-list/queries";
import { useGetPinnedMembers } from "@/features/pinned-members/queries";
import { WS_CHANNEL_TYPE } from "@/shared/types/websocket";
import { Chip } from "@/shared/ui/Chip";
import { useUIStore } from "@/store/uiStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { CreateRoomDialog } from "@/widgets/create-room/CreateRoomDialog";
import IconCreateChatFilled from "@assets/icons/create-chat-filled.svg";
import IconSearchDefault from "@assets/icons/search-default.svg";
import { ChatRoomItem } from "./ChatRoomItem";
import { ChatSearchOverlay } from "./ChatSearchOverlay";
import { ChatSettingsMenu, type ChatSortType } from "./ChatSettingsMenu";
import { CompanyChatManageDialog } from "./CompanyChatManageDialog";
import {
  COMPANY_CHAT_CHIPS,
  lastActivityMs,
  roomFavoriteRank,
  type ChatChip,
  type TaggedRoom,
} from "./chatRoomListUtils";

// 마지막 칩·정렬 (모듈 스코프 — 세션 내 리마운트 간 보존)
let lastActiveChip: ChatChip = 'all';
let lastSortType: ChatSortType = 'latest';

/** 방 나가기 등 외부 이벤트가 목록 복귀 칩을 방 종류에 맞춘다 (RN setCompanyChatChipByChannelType 패리티) */
export function setLastCompanyChatChip(chip: ChatChip) {
  lastActiveChip = chip;
}

export function ChatRoomListSidebar() {
  // 칩·정렬은 모듈 스코프 보존 — 탭 전환(리마운트) 후에도 유지 (RN 스토어 focus 복원 패리티)
  const [activeChip, setActiveChipState] = useState<ChatChip>(() => lastActiveChip);
  const [sortType, setSortTypeState] = useState<ChatSortType>(() => lastSortType);
  const setActiveChip = useCallback((chip: ChatChip) => {
    lastActiveChip = chip;
    setActiveChipState(chip);
  }, []);
  const setSortType = useCallback((sort: ChatSortType) => {
    lastSortType = sort;
    setSortTypeState(sort);
  }, []);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  // 검색은 별도 풀스크린 화면(ChatSearchOverlay) — RN CompanyChatSearchScreen 패리티
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { data: dmRooms = [], isLoading: dmLoading } = useGetDMRoomList();
  const { data: gmRooms = [], isLoading: gmLoading } = useGetGMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();

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

    return sorted;
  }, [dmRooms, gmRooms, activeChip, sortType, pinnedRankMap]);

  const isLoading =
    activeChip === "dm"
      ? dmLoading
      : activeChip === "gm"
        ? gmLoading
        : dmLoading || gmLoading;

  // 검색 진입 — 빈 목록이면 가드 (RN 패리티)
  const openSearch = () => {
    if (dmRooms.length + gmRooms.length === 0) {
      useUIStore.getState().showSnackbar({ message: "검색할 리스트가 존재하지 않습니다." });
      return;
    }
    setIsSearchOpen(true);
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-gray-50">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) — 회색(gray-50) 상단 영역 (Figma #f8f9fa) */}
      <div className="electron-drag flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-heading-xl font-semibold text-text-primary">사내채팅</h2>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={openSearch}
            title="검색"
            aria-label="채팅 검색"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconSearchDefault width={24} height={24} />
          </button>
          <button
            onClick={() => setShowCreateRoom(true)}
            title="새 채팅"
            aria-label="새 채팅"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconCreateChatFilled width={24} height={24} />
          </button>
          <ChatSettingsMenu
            sortType={sortType}
            onSortChange={setSortType}
            onManageRooms={() => setShowManageDialog(true)}
          />
        </div>
      </div>

      {/* 콘텐츠 패널: 회색 상단과 분리된 둥근 흰 영역 (멤버목록 패턴) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {/* 필터 칩 */}
        <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-2">
          {COMPANY_CHAT_CHIPS.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              active={activeChip === chip.key}
              onClick={() => setActiveChip(chip.key)}
            />
          ))}
        </div>

        {/* 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary">
              <Spinner />
            </div>
          ) : visibleRooms.length === 0 ? (
            <EmptyState message="아직 채팅방이 없어요." className="py-10" />
          ) : (
            visibleRooms.map(({ room, channelType }) => (
              <ChatRoomItem
                key={room.roomModel.roomId}
                room={room}
                channelType={channelType}
                pinnedRankMap={pinnedRankMap}
                showFavoriteStar={sortType === "favorite"}
              />
            ))
          )}
        </div>
      </div>

      <CreateRoomDialog
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
      />
      <CompanyChatManageDialog open={showManageDialog} onClose={() => setShowManageDialog(false)} />
      {isSearchOpen && (
        <ChatSearchOverlay
          initialChip={activeChip}
          sortType={sortType}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </aside>
  );
}

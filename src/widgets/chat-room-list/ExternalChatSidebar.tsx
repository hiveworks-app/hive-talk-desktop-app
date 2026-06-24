'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetEMLastMessage } from '@/features/chat-room/api';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { EM_LAST_MESSAGE_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { cn } from '@/shared/lib/cn';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { USER_TYPE } from '@/shared/types/user';
import { canCreateExternalRoom } from '@/shared/utils/permissions';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { formatChatTimestamp } from '@/shared/utils/formatTimeUtils';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GroupProfileAvatar, type GroupAvatarUser } from '@/shared/ui/GroupProfileAvatar';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { CreateExternalRoomDialog } from '@/widgets/create-room/CreateExternalRoomDialog';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCreateChatFilled from '@assets/icons/create-chat-filled.svg';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { ChatSettingsMenu, type ChatSortType } from './ChatSettingsMenu';
import { ChatRoomManageDialog } from './ChatRoomManageDialog';

const NO_PIN_RANK = Number.POSITIVE_INFINITY;
/** 협력채팅 개별 방 안읽음 뱃지 최대치 (정책 chat.md: 300+). */
const EM_BADGE_MAX = 300;

/** 최신 메시지 시각(ms). 메시지 없으면 방 생성 시각으로 폴백. */
const lastActivityMs = (room: GetChatRoomListItemType) =>
  Date.parse(room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? '') || 0;

/** 검색 대상 텍스트: 방 제목 + 참여자 이름 (정책 chat.md). */
const roomSearchText = (room: GetChatRoomListItemType) => {
  const { title, participants } = room.roomModel;
  return [title, ...(participants?.map(p => p.name) ?? [])].filter(Boolean).join(' ');
};

/** 방의 관심멤버 rank — 참여자 중 최소 rank(작을수록 위). 없으면 Infinity. */
const roomFavoriteRank = (room: GetChatRoomListItemType, rankMap: Map<string, number>): number => {
  let min = NO_PIN_RANK;
  for (const p of room.roomModel.participants ?? []) {
    const rank = rankMap.get(String(p.userId));
    if (rank !== undefined && rank < min) min = rank;
  }
  return min;
};

export function ExternalChatSidebar() {
  const [sortType, setSortType] = useState<ChatSortType>('latest');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: emRooms = [], isLoading } = useGetEMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const myUserId = useAuthStore(s => s.user?.id);
  // 게스트(EXTERNAL_USER)는 협력방 생성 불가 → 새 채팅 버튼 숨김 (정책 guest.md)
  const userType = useAuthStore(s => s.user?.userType) ?? USER_TYPE.EXTERNAL_USER;
  const canCreate = canCreateExternalRoom(userType);

  // 검색창 열릴 때 자동 포커스
  useEffect(() => {
    if (isSearchOpen) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchOpen]);

  // 관심멤버 userId → 등록 순서 rank
  const pinnedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    pinnedMembers.forEach((m, i) => map.set(String(m.userId), i));
    return map;
  }, [pinnedMembers]);

  const visibleRooms = useMemo(() => {
    const sorted = [...emRooms].sort((a, b) => {
      if (sortType === 'favorite') {
        const ra = roomFavoriteRank(a, pinnedRankMap);
        const rb = roomFavoriteRank(b, pinnedRankMap);
        if (ra !== rb) return ra - rb;
      }
      return lastActivityMs(b) - lastActivityMs(a);
    });
    return filterByhangeulSearch(sorted, search, roomSearchText);
  }, [emRooms, sortType, pinnedRankMap, search]);

  const isSearching = search.trim().length > 0;

  const toggleSearch = () => {
    if (isSearchOpen) {
      setSearch('');
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
    }
  };
  const closeSearch = () => {
    setSearch('');
    setIsSearchOpen(false);
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-gray-50">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) — 회색(gray-50) 상단 영역 (Figma #f8f9fa) */}
      <div className="electron-drag flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-heading-lg font-semibold text-text-primary">협력채팅</h2>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={toggleSearch}
            title="검색"
            aria-label="협력채팅 검색"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
          >
            <IconSearchDefault width={20} height={20} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreateRoom(true)}
              title="새 협력채팅"
              aria-label="새 협력채팅"
              className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200"
            >
              <IconCreateChatFilled width={20} height={20} />
            </button>
          )}
          <ChatSettingsMenu
            sortType={sortType}
            onSortChange={setSortType}
            onManageRooms={() => setShowManageDialog(true)}
          />
        </div>
      </div>

      {/* 검색바 (인라인 토글) */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isSearchOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') closeSearch();
                }}
                placeholder="채팅방명 또는 참여자 이름 검색"
                className="min-w-0 flex-1 rounded-md border border-divider bg-white px-3 py-1.5 text-sub text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
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

      {/* 콘텐츠 패널: 회색 상단과 분리된 둥근 흰 영역 (멤버목록 패턴) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {/* 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sub text-text-tertiary">로딩 중...</p>
            </div>
          ) : visibleRooms.length === 0 ? (
            <EmptyState
              variant={isSearching ? 'search' : 'sad'}
              message={isSearching ? '검색 결과가 없어요.' : '아직 협력채팅방이 없어요.'}
              className="py-10"
            />
          ) : (
            visibleRooms.map(room => (
              <EMRoomItem
                key={room.roomModel.roomId}
                room={room}
                myUserId={myUserId}
                pinnedRankMap={pinnedRankMap}
              />
            ))
          )}
        </div>
      </div>

      {canCreate && (
        <CreateExternalRoomDialog isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} />
      )}
      <ChatRoomManageDialog open={showManageDialog} onClose={() => setShowManageDialog(false)} />
    </aside>
  );
}

interface EMRoomItemProps {
  room: GetChatRoomListItemType;
  myUserId?: string;
  pinnedRankMap: Map<string, number>;
}

function EMRoomItem({ room, myUserId, pinnedRankMap }: EMRoomItemProps) {
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { roomModel, messageList, notReadCount } = room;
  const lastMessage = messageList[0] ?? null;
  const preview = getLastMessagePreview(lastMessage);
  const time = lastMessage?.message.createdAt ? formatChatTimestamp(lastMessage.message.createdAt) : '';

  // 본인 제외 참여자 (이름순, 최대 4명) — 그룹 프로필/표시명 (정책 chat.md: 본인 제외 최대 4명, 이름순)
  const otherParticipants = useMemo(
    () =>
      (roomModel.participants ?? [])
        .filter(p => String(p.userId) !== String(myUserId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [roomModel.participants, myUserId],
  );

  const avatarUsers: GroupAvatarUser[] = otherParticipants
    .slice(0, 4)
    .map(p => ({ name: p.name, storageKey: p.thumbnailProfileUrl }));

  // 본인만 남은 방 → dimmed 처리 (정책 chat.md)
  const isAlone = otherParticipants.length === 0;

  const displayName =
    roomModel.title || otherParticipants.map(p => p.name).join(', ') || '채팅방';

  // 참여자 중 1명이라도 관심멤버면 ★ 표시 (정렬 모드 무관, Figma 1769-54893 / 사용자 지시)
  const hasPinned = roomFavoriteRank(room, pinnedRankMap) !== NO_PIN_RANK;

  const isActive = params?.roomId === roomModel.roomId;

  const handleClick = async () => {
    if (isActive) return;

    const lastMsg =
      lastMessage ??
      (await queryClient
        .fetchQuery({
          queryKey: EM_LAST_MESSAGE_KEY(roomModel.roomId),
          queryFn: () => apiGetEMLastMessage(roomModel.roomId).then(r => r.payload),
          staleTime: 1000 * 60 * 5,
        })
        .catch(() => null));

    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: roomModel.roomId,
      roomName: displayName,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: roomModel.participants?.length ?? 2,
      otherUserIsExit: isAlone,
      lastMessage: lastMsg ?? null,
      initialNotReadCount: notReadCount,
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
      <div className={cn('shrink-0', isAlone && 'opacity-50')}>
        <GroupProfileAvatar users={avatarUsers} />
      </div>

      <div className={cn('min-w-0 flex-1', isAlone && 'opacity-50')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sub font-medium text-text-primary">{displayName}</span>
            {/* 협력 구분(∞) — 모든 EM 방에 표시 */}
            <IconExternalSymbol width={18} height={18} className="shrink-0 text-gray-400" />
            {/* 관심멤버(★) — 참여자에 관심멤버 포함 시 항상 표시 (gray-400, Figma 1769-54893) */}
            {hasPinned && <IconStarFilled width={18} height={18} className="shrink-0 text-gray-400" />}
          </div>
          <span className="shrink-0 text-sub-sm text-text-tertiary">{time}</span>
        </div>
        <div className="flex items-start gap-2">
          {/* 미리보기: 최대 2줄 ···. 우측엔 최대 뱃지 폭(min-w-[36px]) 고정 거터를 두어
              뱃지 유무와 무관하게 텍스트가 항상 같은 지점에서 멈추고 뱃지와 겹치지 않게 함 (정책 chat.md:92) */}
          <span className="line-clamp-2 min-w-0 flex-1 text-sub-sm text-text-secondary">{preview}</span>
          <div className="flex min-w-[36px] shrink-0 justify-end pt-0.5">
            <Badge count={notReadCount} max={EM_BADGE_MAX} />
          </div>
        </div>
      </div>
    </button>
  );
}

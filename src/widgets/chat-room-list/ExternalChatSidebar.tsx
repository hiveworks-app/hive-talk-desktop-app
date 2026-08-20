'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';
import { IconCaution, IconChatDraft } from '@assets/icons';
import { CreateExternalRoomDialog } from '@/widgets/create-room/CreateExternalRoomDialog';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCreateChatFilled from '@assets/icons/create-chat-filled.svg';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconLeave from '@assets/icons/leave.svg';
import IconBottomChatDefault from '@assets/icons/bottom-chat-default.svg';
import { useLeaveRoom } from '@/features/chat-room-list/useLeaveRoom';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { CursorMenu } from '@/shared/ui/CursorMenu';
import { LEAVE_CONFIRM_DESCRIPTION } from '@/shared/config/constants';
import { ChatSettingsMenu, type ChatSortType } from './ChatSettingsMenu';
import { ChatRoomManageDialog } from './ChatRoomManageDialog';

const NO_PIN_RANK = Number.POSITIVE_INFINITY;

/** 정렬 기준 시각(ms). sortAt 우선(차단 발신자 freeze) → 최신 메시지 → 방 생성 시각 폴백. */
const lastActivityMs = (room: GetChatRoomListItemType) =>
  Date.parse(room.sortAt ?? room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? '') || 0;

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

// 마지막 정렬 (모듈 스코프 — 세션 내 리마운트 간 보존)
let lastEmSortType: ChatSortType = 'latest';

export function ExternalChatSidebar() {
  // 정렬은 모듈 스코프 보존 — 탭 전환(리마운트) 후에도 유지 (RN 스토어 focus 복원 패리티)
  const [sortType, setSortTypeState] = useState<ChatSortType>(() => lastEmSortType);
  const setSortType = useCallback((sort: ChatSortType) => {
    lastEmSortType = sort;
    setSortTypeState(sort);
  }, []);
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
        <h2 className="text-heading-xl font-semibold text-text-primary">협력채팅</h2>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={toggleSearch}
            title="검색"
            aria-label="협력채팅 검색"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconSearchDefault width={24} height={24} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreateRoom(true)}
              title="새 협력채팅"
              aria-label="새 협력채팅"
              className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconCreateChatFilled width={24} height={24} />
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60"
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
              message={isSearching ? '검색 결과가 없어요.' : '아직 채팅방이 없어요.'}
              className="py-10"
            />
          ) : (
            visibleRooms.map(room => (
              <EMRoomItem
                showFavoriteStar={sortType === 'favorite'}
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
  /** ★ 표시 여부 — 관심멤버순 정렬일 때만 (RN showFavoriteStar 패리티) */
  showFavoriteStar?: boolean;
  room: GetChatRoomListItemType;
  myUserId?: string;
  pinnedRankMap: Map<string, number>;
}

function EMRoomItem({ room, myUserId, pinnedRankMap, showFavoriteStar = false }: EMRoomItemProps) {
  const router = useAppRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  // 차단 목록 변경 시 미리보기 접힘 문구 즉시 반영 (구독 목적 — 값 미사용)
  useBlockedMembersStore(s => s.items);
  const { roomModel, messageList, notReadCount } = room;
  // 전송 실패 메시지가 남아있는 방 — 느낌표 표시 (RN 패리티)
  const hasFailedMessage = useFailedMessagesStore(
    s => (s.byRoom[roomModel.roomId]?.length ?? 0) > 0,
  );
  // 작성 중 드래프트가 있는 방 — 말풍선 점3 아이콘 (RN 패리티, 미리보기 문구는 유지)
  const hasDraft = useDraftStore(s => Boolean(s.drafts[roomModel.roomId]?.trim()));
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

  // ★는 관심멤버순 정렬일 때만 표시 (RN showFavoriteStar 패리티 — 2026-08-18 앱 기준 통일)
  const hasPinned = showFavoriteStar && roomFavoriteRank(room, pinnedRankMap) !== NO_PIN_RANK;

  const isActive = params?.roomId === roomModel.roomId;

  // 개별 나가기 (hover 액션 — RN 스와이프 나가기 대응)
  const { leaveRoom } = useLeaveRoom();
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // 우클릭 컨텍스트 메뉴 (데스크톱 관례) — 커서 좌표
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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
      otherUserIsRemoved: false, // EM은 해당 없음 — 이전 DM 방 값 잔존 방지 명시 재설정
      lastMessage: lastMsg ?? null,
      initialNotReadCount: notReadCount,
    });

    router.push(`/external-chat/${roomModel.roomId}`);
  };

  return (
    <div className="group relative">
    <button
      onClick={handleClick}
      onContextMenu={e => {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
      className={cn(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors group-hover:bg-gray-150',
        isActive && 'bg-gray-150',
      )}
    >
      {/* RN 패리티 — dimmed는 아바타 white/70 오버레이 + 텍스트 gray-400 */}
      <div className="relative shrink-0">
        <GroupProfileAvatar users={avatarUsers} />
        {isAlone && <div className="pointer-events-none absolute inset-0 rounded-full bg-white/70" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <span className={cn('truncate text-body font-medium', isAlone ? 'text-gray-400' : 'text-text-primary')}>{displayName}</span>
            {/* RN 패리티 — ★ 먼저, ∞ 나중 순서 */}
            {hasPinned && <IconStarFilled width={16} height={16} className="shrink-0 text-gray-400" />}
            <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
          </div>
          {/* 시간 — 12px 직접 지정: 사내채팅 목록과 동일 */}
          <span className={cn('shrink-0 text-[12px] leading-[15px]', isAlone ? 'text-gray-400' : 'text-gray-500')}>{time}</span>
        </div>
        <div className="flex items-start gap-2">
          {/* 미리보기: 최대 2줄 ···. 우측엔 최대 뱃지 폭(min-w-[36px]) 고정 거터를 두어
              뱃지 유무와 무관하게 텍스트가 항상 같은 지점에서 멈추고 뱃지와 겹치지 않게 함 (정책 chat.md:92) */}
          <span className={cn('line-clamp-2 min-w-0 flex-1 text-sub-sm', isAlone ? 'text-gray-400' : 'text-text-secondary')}>{preview}</span>
          <div className="flex min-w-[54px] shrink-0 items-center justify-end gap-1 pt-0.5">
            {/* 전송실패(느낌표)가 작성중(드래프트)보다 우선 — 배타 표시 (RN ListChat 패리티) */}
            {hasFailedMessage ? (
              <IconCaution width={20} height={20} className="shrink-0 text-gray-500" aria-label="전송 실패 메시지 있음" />
            ) : (
              hasDraft && <IconChatDraft width={20} height={20} className="shrink-0 text-gray-500" aria-label="작성 중인 메시지 있음" />
            )}
            <Badge count={notReadCount} />
          </div>
        </div>
      </div>
    </button>

    {/* 나가기 진입은 우클릭 메뉴로 일원화 (hover 버튼 제거 — 사용자 결정 2026-08-20) */}

    {/* 우클릭 메뉴 — [채팅방 열기 / 나가기] */}
    {menuPos && (
      <CursorMenu
        x={menuPos.x}
        y={menuPos.y}
        items={[
          { label: '채팅방 열기', icon: <IconBottomChatDefault width={20} height={20} className="text-gray-600" />, onSelect: () => { setMenuPos(null); void handleClick(); } },
          { label: '나가기', icon: <IconLeave width={20} height={20} />, danger: true, onSelect: () => { setMenuPos(null); setLeaveConfirmOpen(true); } },
        ]}
        onClose={() => setMenuPos(null)}
      />
    )}

    <ConfirmDialog
      open={isLeaveConfirmOpen}
      title={displayName}
      description={LEAVE_CONFIRM_DESCRIPTION.GROUP}
      confirmLabel="나가기"
      cancelLabel="취소"
      destructive
      onConfirm={() => {
        setLeaveConfirmOpen(false);
        leaveRoom(roomModel.roomId, WS_CHANNEL_TYPE.EXTERNAL_MESSAGE);
      }}
      onCancel={() => setLeaveConfirmOpen(false)}
    />
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { USER_ROLE } from '@/shared/types/user';
import { canCreateChatRoom } from '@/shared/utils/permissions';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconCreateChatFilled from '@assets/icons/create-chat-filled.svg';
import { CreateExternalRoomDialog } from '@/widgets/create-room/CreateExternalRoomDialog';
import { ChatSettingsMenu, type ChatSortType } from './ChatSettingsMenu';
import { ChatRoomManageDialog } from './ChatRoomManageDialog';
import { EMRoomItem } from './EMRoomItem';
import { ExternalChatSearchOverlay } from './ExternalChatSearchOverlay';
import { emRoomFavoriteRank, lastActivityMs } from './chatRoomListUtils';

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
  // 검색은 풀스크린 오버레이 (RN ExternalChatSearchScreen 패리티 — 사내채팅과 동일 체계)
  const [isSearchOpen, setSearchOpen] = useState(false);

  const { data: emRooms = [], isPending: emPending } = useGetEMRoomList();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const myUserId = useAuthStore(s => s.user?.id);
  // 새로고침 직후 user 복원 전엔 쿼리가 비활성이라 isLoading이 false — 빈 상태("아직 채팅방이
  // 없어요")가 잠깐 새어 나온다. user 미복원 + 데이터 미도착을 모두 로딩으로 취급 (사내 목록과 동일)
  const isLoading = !myUserId || emPending;
  // 게스트(role=GUEST)는 협력방 생성 불가 → 새 채팅 버튼 숨김 (정책 guest.md).
  // RN과 동일하게 role 축 사용 — userType 축은 companyId가 있는 GUEST에서 버튼이 노출됐다 (2026-08-26 감사)
  const role = useAuthStore(s => s.user?.role) ?? USER_ROLE.GUEST;
  const canCreate = canCreateChatRoom(role);

  // 관심멤버 userId → 등록 순서 rank
  const pinnedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    pinnedMembers.forEach((m, i) => map.set(String(m.userId), i));
    return map;
  }, [pinnedMembers]);

  const visibleRooms = useMemo(() => {
    return [...emRooms].sort((a, b) => {
      if (sortType === 'favorite') {
        const ra = emRoomFavoriteRank(a, pinnedRankMap);
        const rb = emRoomFavoriteRank(b, pinnedRankMap);
        if (ra !== rb) return ra - rb;
      }
      return lastActivityMs(b) - lastActivityMs(a);
    });
  }, [emRooms, sortType, pinnedRankMap]);

  // RN 패리티 — 방이 하나도 없으면 검색 화면 대신 스낵바
  const handleOpenSearch = () => {
    if (emRooms.length === 0) {
      useUIStore.getState().showSnackbar({ message: '검색할 리스트가 존재하지 않습니다.' });
      return;
    }
    setSearchOpen(true);
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-divider bg-gray-50">
      {/* 헤더 (드래그 가능, 버튼만 no-drag) — 회색(gray-50) 상단 영역 (Figma #f8f9fa) */}
      <div className="electron-drag flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-heading-xl font-semibold text-text-primary">협력채팅</h2>
        <div className="electron-no-drag flex items-center gap-1">
          <button
            onClick={handleOpenSearch}
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

      {/* 콘텐츠 패널: 회색 상단과 분리된 둥근 흰 영역 (멤버목록 패턴) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {/* 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary">
              <Spinner />
            </div>
          ) : visibleRooms.length === 0 ? (
            <EmptyState variant="sad" message="아직 채팅방이 없어요." className="py-10" />
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

      {isSearchOpen && (
        <ExternalChatSearchOverlay sortType={sortType} onClose={() => setSearchOpen(false)} />
      )}
    </aside>
  );
}

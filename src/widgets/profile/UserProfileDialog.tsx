'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { useDeleteExternalContact } from '@/features/external-member/queries';
import { useTogglePinnedMember } from '@/features/pinned-members/useTogglePinnedMember';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ProfileDialogShell } from './ProfileDialogShell';
import { ProfileInfoSection } from './ProfileInfoSection';
import { MemberItem, USER_ROLE } from '@/shared/types/user';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import IconChat from '@assets/icons/chat-filled.svg';
import IconMenu from '@assets/icons/topbar-menu.svg';
import IconDelete from '@assets/icons/delete-filled.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconStarEmpty from '@assets/icons/star-empty.svg';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberItem | null;
}

/**
 * 타사용자 프로필 모달 (사내멤버 / 협력멤버 공통).
 * member.isExternal 로 분기:
 * - 사내멤버: 헤더 우측 ☆ 관심멤버 토글
 * - 협력멤버: 회사명 라인 + ∞ 배지 + 케밥(관심멤버 지정/해제 · 멤버 삭제)
 * 관심멤버 "토글"은 지원하되, 목록 순서변경·일괄 편집은 모바일 전담(데스크톱 미지원).
 */
export function UserProfileDialog({ isOpen, onClose, member }: UserProfileDialogProps) {
  useDimmed(isOpen);
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore(s => s.user?.id);
  const viewerRole = useAuthStore(s => s.user?.role);
  const { mutate: deleteContact } = useDeleteExternalContact();
  const togglePin = useTogglePinnedMember();
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!isOpen || !member) return null;

  const isMe = member.userId === myUserId;
  const isExternal = member.isExternal === true;
  const isViewerGuest = viewerRole === USER_ROLE.GUEST;
  const isPinned = togglePin.isPinned(member.userId);
  // 사내멤버 헤더 별 토글 노출 조건 (모바일 패리티): 본인·협력멤버 제외, 게스트 뷰어 제외
  const showStar = !isMe && !isExternal && !isViewerGuest;
  // 협력멤버는 회사명+부서+직책, 사내멤버는 부서+직책 (falsy는 InfoSection이 제외)
  const lines = isExternal
    ? [member.companyName, member.department, member.job]
    : [member.department, member.job];

  const navigateToRoom = (
    roomId: string,
    lastMessage: import('@/shared/types/websocket').WebSocketPublishItem | null = null,
    invitedUserIds: string[] = [],
  ) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName: member.name,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      lastMessage,
      invitedUserIds,
    });
    if (!roomId) {
      useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    }
    onClose();
    router.push(roomId ? `/chat/${roomId}` : '/chat/new');
  };

  const findExistingRoom = () => {
    const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
    return dmRooms.find(room => {
      const uid = String(member.userId);
      if (String(room.roomModel.participantDetail?.userId) === uid) return true;
      return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
    });
  };

  const handleStartDM = () => {
    if (isMe) return;

    // 캐시에서 기존 방 확인
    const existing = findExistingRoom();
    if (existing) {
      navigateToRoom(existing.roomModel.roomId, existing.messageList[0] ?? null);
      return;
    }

    // 기존 방 없음 → roomId 없이 채팅방 진입 (메시지 전송 시 생성)
    navigateToRoom('', null, [member.userId]);
  };

  // 협력멤버 삭제 — 확인 다이얼로그에서 '삭제' 시 실행. 데스크톱 API(useDeleteExternalContact) 사용.
  const handleDeleteConfirm = () => {
    deleteContact(String(member.userId));
    setDeleteConfirmOpen(false);
    onClose();
  };

  // 협력멤버 케밥(관심멤버 토글 + 멤버 삭제) / 사내멤버 헤더 별 토글
  let headerRight: React.ReactNode = null;
  if (isExternal && !isMe) {
    headerRight = (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="멤버 메뉴"
            className="flex h-8 w-8 items-center justify-center rounded text-text-primary transition-colors hover:bg-surface-pressed data-[state=open]:bg-surface-pressed"
          >
            <IconMenu width={20} height={20} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-[60] w-[166px] overflow-hidden rounded-xl bg-white py-1 shadow-[0px_2px_22px_rgba(0,0,0,0.12)] focus:outline-none"
          >
            <DropdownMenu.Item
              onSelect={() => togglePin.toggle(member.userId)}
              className="flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sub text-text-primary outline-none data-[highlighted]:bg-gray-100"
            >
              {isPinned ? (
                <IconStarFilled width={20} height={20} className="text-yellow" />
              ) : (
                <IconStarEmpty width={20} height={20} className="text-text-secondary" />
              )}
              {isPinned ? '관심멤버 해제' : '관심멤버 지정'}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-divider" />
            <DropdownMenu.Item
              // 메뉴가 닫히며 트리거로 포커스를 되돌린 뒤 다이얼로그를 열어 포커스 트랩 충돌 방지
              onSelect={() => setTimeout(() => setDeleteConfirmOpen(true), 0)}
              className="flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sub text-state-error outline-none data-[highlighted]:bg-gray-100"
            >
              <IconDelete width={20} height={20} />
              멤버 삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  } else if (showStar) {
    headerRight = (
      <button
        type="button"
        onClick={() => togglePin.toggle(member.userId)}
        disabled={togglePin.isPending || togglePin.isLoading}
        aria-label={isPinned ? '관심멤버 해제' : '관심멤버 지정'}
        aria-pressed={isPinned}
        className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-surface-pressed disabled:opacity-50"
      >
        {isPinned ? (
          <IconStarFilled width={22} height={21} className="text-yellow" />
        ) : (
          <IconStarEmpty width={22} height={21} className="text-text-primary" />
        )}
      </button>
    );
  }

  return (
    <>
      <ProfileDialogShell title="멤버 프로필" onClose={onClose} headerRight={headerRight}>
        <div className="flex flex-col px-4 pb-6 pt-7">
          <ProfileInfoSection
            name={member.name}
            email={member.email}
            storageKey={member.profileUrl || member.thumbnailProfileUrl}
            lines={lines}
            isExternal={isExternal}
          />

          {/* 1:1 채팅 (본인 제외) */}
          {!isMe && (
            <button
              onClick={handleStartDM}
              className="mt-[30px] flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-primary bg-surface text-[16px] font-medium text-primary transition-colors hover:bg-state-primary-highlighted"
            >
              <IconChat width={20} height={20} />
              1:1 채팅
            </button>
          )}
        </div>
      </ProfileDialogShell>

      {/* 협력멤버 삭제 확인 (Figma node 858:8767 패리티) */}
      {isExternal && (
        <ConfirmDialog
          open={isDeleteConfirmOpen}
          title="멤버목록에서 삭제할까요?"
          description={
            <>
              삭제하면 상대방의 멤버 목록에서도 삭제돼요.
              <br />
              채팅 기록은 유지돼요.
            </>
          }
          confirmLabel="삭제"
          cancelLabel="취소"
          destructive
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </>
  );
}

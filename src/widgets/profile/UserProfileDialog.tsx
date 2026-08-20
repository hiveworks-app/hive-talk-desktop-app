'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { useDeleteExternalContact, useInviteExternalByEmail } from '@/features/external-member/queries';
import { BLOCK_MESSAGES } from '@/features/block/blockedMessage';
import { isBlockableMember } from '@/features/block/isBlockable';
import { useBlockMember, useGetBlockedMembers, useUnblockMember } from '@/features/block/queries';
import { useCheckDuplicateEM } from '@/features/external-chat/queries';
import { useTogglePinnedMember } from '@/features/pinned-members/useTogglePinnedMember';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { UNKNOWN_USER_NAME } from '@/shared/config/constants';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';
import { ExternalInviteDialog } from '@/widgets/external-invite/ExternalInviteDialog';
import { ProfileDialogShell } from './ProfileDialogShell';
import { ProfileInfoSection } from './ProfileInfoSection';
import { MemberItem, USER_ROLE } from '@/shared/types/user';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useUIStore } from '@/store/uiStore';
import IconBlock from '@assets/icons/block.svg';
import IconChat from '@assets/icons/bottom-chat-default.svg';
import IconEnvelope from '@assets/icons/envelope.svg';
import IconMenu from '@assets/icons/topbar-menu.svg';
import IconDelete from '@assets/icons/delete-filled.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconStarEmpty from '@assets/icons/star-empty.svg';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberItem | null;
  /** 미등록(비관계) 사용자 — 멤버목록에 없는 채팅 참여자. [멤버초대] 버튼으로 대체 (RN C5 패리티) */
  unregistered?: boolean;
  /** DM 방 안에서 상대 프로필을 연 경우 — [1:1 채팅] 비활성 (RN 패리티) */
  disableDirectChat?: boolean;
}

/**
 * 타사용자 프로필 모달 (사내멤버 / 협력멤버 공통).
 * member.isExternal 로 분기:
 * - 사내멤버: 헤더 우측 ☆ 관심멤버 토글
 * - 협력멤버: 회사명 라인 + ∞ 배지 + 케밥(관심멤버 지정/해제 · 멤버 삭제)
 * 관심멤버 "토글"은 지원하되, 목록 순서변경·일괄 편집은 모바일 전담(데스크톱 미지원).
 */
export function UserProfileDialog({ isOpen, onClose, member, unregistered = false, disableDirectChat = false }: UserProfileDialogProps) {
  useDimmed(isOpen);
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore(s => s.user?.id);
  const viewerRole = useAuthStore(s => s.user?.role);
  const viewerCompanyId = useAuthStore(s => s.user?.companyId);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const { mutate: deleteContact } = useDeleteExternalContact();
  const togglePin = useTogglePinnedMember();
  const { data: blockedMembers = [] } = useGetBlockedMembers();
  const { mutate: blockMember } = useBlockMember();
  const { mutate: unblockMember } = useUnblockMember();
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isBlockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [isUnblockConfirmOpen, setUnblockConfirmOpen] = useState(false);
  const [isInviteOpen, setInviteOpen] = useState(false);
  // 미등록 사용자 멤버초대 — RN 패리티: 즉시 컨펌 후 이메일 초대 (이메일 없으면 검색 다이얼로그 폴백)
  const [isInviteConfirmOpen, setInviteConfirmOpen] = useState(false);
  const { mutateAsync: inviteByEmail } = useInviteExternalByEmail();
  // 협력멤버 1:1 EM 생성 — 방 제목 입력 단계 (RN 제목 입력 화면 대응)
  const [emTitleDraft, setEmTitleDraft] = useState<string | null>(null);
  const { mutateAsync: checkDuplicateEM, isPending: isCheckingEM } = useCheckDuplicateEM();

  if (!isOpen || !member) return null;

  const isMe = member.userId === myUserId;
  const isExternal = member.isExternal === true;
  const isViewerGuest = viewerRole === USER_ROLE.GUEST;
  // 탈퇴 사용자 — 계정 삭제로 모든 액션 무의미 (버튼·케밥 전부 숨김, RN C6 패리티)
  const isUnknownUser = member.name === UNKNOWN_USER_NAME;
  const isPinned = togglePin.isPinned(member.userId);
  // 차단 상태 — 차단 목록 쿼리가 단일 진실 소스 (RN 패리티)
  const isBlocked = blockedMembers.some(m => String(m.userId) === String(member.userId));
  // 차단 가능 — 내 회사 ADMIN은 불가 (정책 U020)
  const isBlockable = !isMe && isBlockableMember(member, viewerCompanyId);
  // 사내멤버 헤더 별 토글 노출 조건 (모바일 패리티): 본인·협력멤버 제외, 게스트 뷰어 제외, 차단 상태 제외
  const showStar = !isMe && !isExternal && !isViewerGuest && !isBlocked;
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
      otherUserIsRemoved: false,
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

  // 협력멤버 1:1 — DM이 아닌 EM 플로우 (정책 em.md, RN C1 패리티): 중복검사 → 기존 방 이동 / 새 방 제목 입력
  const enterEMRoom = (roomId: string, title: string) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName: title || member.name,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      lastMessage: null,
      invitedUserIds: [],
    });
    onClose();
    router.push(`/external-chat/${roomId}`);
  };

  const handleStartEMChat = async () => {
    if (isMe || isCheckingEM) return;
    try {
      const res = await checkDuplicateEM([String(member.userId), String(myUserId)].filter(Boolean));
      const { exists, roomIds } = res.payload;
      if (exists && roomIds[0]) {
        // 기존 협력방으로 이동 — 캐시에서 제목 조회
        const cached = queryClient.getQueryData<GetChatRoomListItemType[]>(EM_ROOM_LIST_KEY) ?? [];
        const found = cached.find(r => r.roomModel.roomId === roomIds[0]);
        enterEMRoom(roomIds[0], found?.roomModel.title ?? member.name);
        return;
      }
    } catch {
      // 검사 실패는 생성 시 서버가 재검증 (RN §7-C-6 정책) — 제목 입력으로 진행
    }
    setEmTitleDraft(member.name);
  };

  // 방을 즉시 만들지 않고 draft로 진입 — 첫 메시지 전송 시 POST /app/em (RN 패리티, 취소 시 빈 방 잔존 방지)
  const handleCreateEMConfirm = () => {
    const title = (emTitleDraft ?? '').trim();
    if (!title) return;
    setEmTitleDraft(null);
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: '',
      roomName: title,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      invitedUserIds: [String(member.userId)],
      lastMessage: null,
      initialNotReadCount: 0,
    });
    useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    onClose();
    router.push('/external-chat/new');
  };

  // 협력멤버 삭제 — 확인 다이얼로그에서 '삭제' 시 실행. 데스크톱 API(useDeleteExternalContact) 사용.
  const handleDeleteConfirm = () => {
    deleteContact(String(member.userId));
    setDeleteConfirmOpen(false);
    onClose();
  };

  // 차단 — 사내멤버는 '차단되었어요.', 협력/비관계는 관리 화면 힌트 (RN 토스트 정책 패리티)
  const handleBlockConfirm = () => {
    blockMember(member, {
      onSuccess: () => {
        showSnackbar({
          message: isExternal ? BLOCK_MESSAGES.blockManageHint : BLOCK_MESSAGES.blocked,
        });
      },
    });
    setBlockConfirmOpen(false);
    onClose();
  };

  const handleUnblockConfirm = () => {
    unblockMember(String(member.userId), {
      onSuccess: () => showSnackbar({ message: BLOCK_MESSAGES.unblocked, state: 'success' }),
    });
    setUnblockConfirmOpen(false);
  };

  // 헤더 우측: 협력멤버 케밥(관심멤버·차단·삭제) / 사내멤버 별 토글 + 차단 케밥 / 차단 상태면 '차단해제'
  // 탈퇴자는 모든 액션 무의미 → 케밥/버튼 전부 숨김 (RN 패리티)
  let headerRight: React.ReactNode = null;
  if (isUnknownUser) {
    headerRight = null;
  } else if (unregistered && !isMe) {
    // 미등록(비관계) — 텍스트 "차단"/"차단해제" 버튼만 (RN 패리티)
    headerRight = isBlocked ? (
      <button
        type="button"
        onClick={() => setUnblockConfirmOpen(true)}
        className="flex h-8 items-center rounded px-2 text-sub font-medium text-primary transition-opacity hover:opacity-70 active:opacity-60"
      >
        차단해제
      </button>
    ) : isBlockable ? (
      <button
        type="button"
        onClick={() => setBlockConfirmOpen(true)}
        className="flex h-8 items-center rounded px-2 text-sub font-medium text-text-secondary transition-opacity hover:opacity-70 active:opacity-60"
      >
        차단
      </button>
    ) : null;
  } else if (isExternal && !isMe) {
    headerRight = (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="멤버 메뉴"
            className="flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60 data-[state=open]:bg-surface-pressed"
          >
            <IconMenu width={20} height={20} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          {/* RN AnchoredActionMenu 패리티 — 160px, 행 46px·text-body, 행 간 구분선, 삭제도 기본색 */}
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="motion-menu z-[60] w-40 overflow-hidden rounded-xl bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)] focus:outline-none"
          >
            {!isBlocked && (
              <DropdownMenu.Item
                onSelect={() => togglePin.toggle(member.userId)}
                className="flex h-[46px] cursor-pointer items-center gap-1.5 border-b border-gray-200 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
              >
                {isPinned ? (
                  <IconStarFilled width={20} height={20} className="text-yellow" />
                ) : (
                  <IconStarEmpty width={20} height={20} className="text-gray-600" />
                )}
                {isPinned ? '관심멤버 해제' : '관심멤버 지정'}
              </DropdownMenu.Item>
            )}
            {isBlocked ? (
              <DropdownMenu.Item
                // 메뉴가 닫히며 트리거로 포커스를 되돌린 뒤 다이얼로그를 열어 포커스 트랩 충돌 방지
                onSelect={() => setTimeout(() => setUnblockConfirmOpen(true), 0)}
                className="flex h-[46px] cursor-pointer items-center gap-1.5 border-b border-gray-200 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
              >
                <IconBlock width={20} height={20} className="text-gray-600" />
                차단 해제
              </DropdownMenu.Item>
            ) : (
              isBlockable && (
                <DropdownMenu.Item
                  onSelect={() => setTimeout(() => setBlockConfirmOpen(true), 0)}
                  className="flex h-[46px] cursor-pointer items-center gap-1.5 border-b border-gray-200 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
                >
                  <IconBlock width={20} height={20} className="text-gray-600" />
                  차단하기
                </DropdownMenu.Item>
              )
            )}
            <DropdownMenu.Item
              onSelect={() => setTimeout(() => setDeleteConfirmOpen(true), 0)}
              className="flex h-[46px] cursor-pointer items-center gap-1.5 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
            >
              <IconDelete width={20} height={20} className="text-gray-600" />
              멤버 삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  } else if (!isMe && !isExternal && isBlocked) {
    // 차단된 사내멤버 — '차단해제' 텍스트 버튼 (RN 패리티, Figma 3187:59443)
    headerRight = (
      <button
        type="button"
        onClick={() => setUnblockConfirmOpen(true)}
        className="flex h-8 items-center rounded px-2 text-sub font-medium text-primary transition-opacity hover:opacity-70 active:opacity-60"
      >
        차단해제
      </button>
    );
  } else if (showStar) {
    // RN 패리티 — 사내멤버는 별 토글이 아닌 케밥(···) 단일 버튼 → [관심멤버 지정/해제, 차단하기] 메뉴
    headerRight = (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="멤버 메뉴"
            className="flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60 data-[state=open]:bg-surface-pressed"
          >
            <IconMenu width={20} height={20} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          {/* RN AnchoredActionMenu 패리티 — 160px, 행 46px·text-body, 행 간 구분선 */}
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="motion-menu z-[60] w-40 overflow-hidden rounded-xl bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)] focus:outline-none"
          >
            <DropdownMenu.Item
              onSelect={() => togglePin.toggle(member.userId)}
              disabled={togglePin.isPending || togglePin.isLoading}
              className={cn(
                'flex h-[46px] cursor-pointer items-center gap-1.5 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200 data-[disabled]:opacity-50',
                isBlockable && 'border-b border-gray-200',
              )}
            >
              {isPinned ? (
                <IconStarFilled width={20} height={20} className="text-yellow" />
              ) : (
                <IconStarEmpty width={20} height={20} className="text-gray-600" />
              )}
              {isPinned ? '관심멤버 해제' : '관심멤버 지정'}
            </DropdownMenu.Item>
            {/* 사내멤버 차단 진입점 (정책 block.md — 내 회사 ADMIN은 차단 불가 U020) */}
            {isBlockable && (
              <DropdownMenu.Item
                onSelect={() => setTimeout(() => setBlockConfirmOpen(true), 0)}
                className="flex h-[46px] cursor-pointer items-center gap-1.5 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
              >
                <IconBlock width={20} height={20} className="text-gray-600" />
                차단하기
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <>
      <ProfileDialogShell title="멤버 프로필" onClose={onClose} headerRight={headerRight}>
        {/* RN UserProfileView 패리티 — 콘텐츠 세로 중앙 정렬, 정보 블록과 버튼 사이 30px */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <div className="flex w-full flex-col items-center gap-[30px]">
            <ProfileInfoSection
              name={isUnknownUser ? UNKNOWN_USER_NAME : member.name}
              email={isUnknownUser ? undefined : member.email}
              storageKey={isUnknownUser ? undefined : member.profileUrl || member.thumbnailProfileUrl}
              lines={isUnknownUser ? [] : lines}
              // RN 패리티 — 연결 배지는 등록된 협력멤버만 (미등록 외부인 제외)
              isExternal={isExternal && !isUnknownUser && !unregistered}
              isBlocked={isBlocked}
              isUnknownUser={isUnknownUser}
              compactGap
            />

            {/* 하단 버튼 매트릭스 (RN C1~C6 패리티):
                GUEST 뷰어·탈퇴자 = 버튼 없음(빈 자리로 세로 균형 유지 — RN h-14 placeholder)
                미등록 = [멤버초대] / 협력 = EM 플로우 / 사내 = DM */}
            {!isMe && !isViewerGuest && !isUnknownUser ? (
              unregistered ? (
                /* RN 패리티 — 즉시 컨펌 → 이메일 초대. 이메일 미보유 시 검색 다이얼로그 폴백 */
                <button
                  onClick={() => (member.email ? setInviteConfirmOpen(true) : setInviteOpen(true))}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-primary bg-surface text-body font-medium text-primary transition-colors hover:bg-state-primary-highlighted"
                >
                  <IconEnvelope width={20} height={20} />
                  멤버초대
                </button>
              ) : (
                <button
                  onClick={isExternal ? handleStartEMChat : handleStartDM}
                  disabled={disableDirectChat || isCheckingEM}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-primary bg-surface text-body font-medium text-primary transition-colors hover:bg-state-primary-highlighted disabled:cursor-default disabled:border-outline disabled:text-text-tertiary disabled:hover:bg-surface"
                >
                  <IconChat width={20} height={20} />
                  1:1 채팅
                </button>
              )
            ) : (
              <div className="h-10 w-full" />
            )}
          </div>
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

      {/* 차단 확인 (RN useBlockConfirm 패리티, Figma 3105:143335) */}
      <ConfirmDialog
        open={isBlockConfirmOpen}
        title={`${member.name}님을 차단할까요?`}
        description={BLOCK_MESSAGES.blockConfirmDescription}
        confirmLabel="차단"
        cancelLabel="취소"
        neutral
        onConfirm={handleBlockConfirm}
        onCancel={() => setBlockConfirmOpen(false)}
      />

      {/* 협력멤버 1:1 EM 생성 — 방 제목 입력 (RN 제목 입력 화면 대응) */}
      {emTitleDraft !== null && (
        <ConfirmDialog
          open
          title="협력채팅 방 제목"
          description={
            <input
              type="text"
              value={emTitleDraft}
              onChange={e => setEmTitleDraft(e.target.value.slice(0, 50))}
              placeholder="방 제목을 입력해주세요 (1~50자)"
              className="mt-1 h-10 w-full rounded-lg border border-outline px-3 text-sub text-text-primary outline-none focus:border-primary"
            />
          }
          confirmLabel="만들기"
          cancelLabel="취소"
          onConfirm={handleCreateEMConfirm}
          onCancel={() => setEmTitleDraft(null)}
        />
      )}

      {/* 미등록 사용자 멤버초대 — 즉시 컨펌 (RN 패리티) */}
      <ConfirmDialog
        open={isInviteConfirmOpen}
        title={`${member.name}님을 멤버로 초대할까요?`}
        confirmLabel="초대"
        cancelLabel="취소"
        onConfirm={() => {
          setInviteConfirmOpen(false);
          if (!member.email) return;
          void inviteByEmail(member.email)
            .then(() => showSnackbar({ message: '멤버로 초대되었어요.', state: 'success' }))
            .catch(() => showSnackbar({ message: '멤버 초대에 실패했습니다.', state: 'error' }));
        }}
        onCancel={() => setInviteConfirmOpen(false)}
      />

      {/* 미등록 사용자 멤버초대 폴백 (이메일 미보유 시 — 이메일/연락처 검색 초대 다이얼로그) */}
      {isInviteOpen && (
        <ExternalInviteDialog
          open
          onClose={() => setInviteOpen(false)}
          presetEmail={member.email ?? undefined}
        />
      )}

      {/* 차단 해제 확인 (RN useUnblockConfirm 패리티, Figma 3187:59443) */}
      <ConfirmDialog
        open={isUnblockConfirmOpen}
        title={`${member.name}님을 차단해제 할까요?`}
        description={BLOCK_MESSAGES.unblockConfirmDescription}
        confirmLabel="차단해제"
        cancelLabel="취소"
        onConfirm={handleUnblockConfirm}
        onCancel={() => setUnblockConfirmOpen(false)}
      />
    </>
  );
}

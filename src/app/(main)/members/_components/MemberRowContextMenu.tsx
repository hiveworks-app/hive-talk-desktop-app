'use client';

import { useState } from 'react';
import { useBlockMember } from '@/features/block/queries';
import { BLOCK_MESSAGES } from '@/features/block/blockedMessage';
import { isBlockableMember } from '@/features/block/isBlockable';
import { StartEMTitleDialog } from '@/features/chat-room/StartEMTitleDialog';
import { useStartMemberChat } from '@/features/chat-room/useStartMemberChat';
import { useTogglePinnedMember } from '@/features/pinned-members/useTogglePinnedMember';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { CursorMenu, type CursorMenuItem } from '@/shared/ui/CursorMenu';
import { USER_ROLE, type MemberItem } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import IconBlock from '@assets/icons/block.svg';
import IconChat from '@assets/icons/bottom-chat-default.svg';
import IconPersonDefault from '@assets/icons/person-default.svg';
import IconStarEmpty from '@assets/icons/star-empty.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';

interface MemberRowContextMenuProps {
  member: MemberItem;
  /** 우클릭 커서 좌표 */
  x: number;
  y: number;
  onOpenProfile: () => void;
  onClose: () => void;
}

/**
 * 멤버 행 우클릭 메뉴 (데스크톱 관례) — [1:1 채팅 / 프로필 보기 / 관심멤버 지정·해제 / 차단하기].
 * 액션 규칙·컨펌·스낵바는 프로필 화면(UserProfileDialog)과 동일:
 * 본인 행은 프로필만, 1:1 채팅·관심멤버는 게스트 뷰어 제외, 차단은 정책(isBlockableMember) 충족 시.
 */
export function MemberRowContextMenu({ member, x, y, onOpenProfile, onClose }: MemberRowContextMenuProps) {
  const myUserId = useAuthStore(s => s.user?.id);
  const viewerRole = useAuthStore(s => s.user?.role);
  const viewerCompanyId = useAuthStore(s => s.user?.companyId);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const togglePin = useTogglePinnedMember();
  const { mutate: blockMember } = useBlockMember();
  const [isBlockConfirmOpen, setBlockConfirmOpen] = useState(false);
  // 이동 시 메뉴가 닫힘 — EM 신규는 제목 입력 다이얼로그로 교체 렌더 (아래 early return)
  const startMemberChat = useStartMemberChat({ onBeforeNavigate: onClose });

  const isMe = String(member.userId) === String(myUserId);
  const isViewerGuest = viewerRole === USER_ROLE.GUEST;
  const isPinned = togglePin.isPinned(member.userId);

  // 아이콘 체계는 프로필 케밥 메뉴와 동일 — 20px, 별은 상태별(채움 yellow/빈 별 gray)
  const items: CursorMenuItem[] = [];
  if (!isMe && !isViewerGuest) {
    items.push({
      label: '1:1 채팅',
      icon: <IconChat width={20} height={20} className="text-gray-600" />,
      // DM·기존 EM은 즉시 이동(onBeforeNavigate가 메뉴 닫음), EM 신규는 emTitleDraft가
      // 세팅되어 메뉴가 제목 입력으로 교체된다 — 여기서 onClose()를 부르지 않는다.
      onSelect: () => startMemberChat.startChat(member),
    });
  }
  items.push({
    label: '프로필 보기',
    // 사람 실루엣 (person-default — 멤버 탭 아이콘은 +가 붙어 있어 '추가'로 오독됨)
    icon: <IconPersonDefault width={20} height={20} className="text-gray-600" />,
    onSelect: () => {
      onClose();
      onOpenProfile();
    },
  });
  if (!isMe && !isViewerGuest) {
    items.push({
      label: isPinned ? '관심멤버 해제' : '관심멤버 지정',
      icon: isPinned ? (
        <IconStarFilled width={20} height={20} className="text-yellow" />
      ) : (
        <IconStarEmpty width={20} height={20} className="text-gray-600" />
      ),
      onSelect: () => {
        onClose();
        void togglePin.toggle(String(member.userId));
      },
    });
  }
  if (!isMe && isBlockableMember(member, viewerCompanyId)) {
    // 메뉴 → 컨펌으로 교체 (onClose는 컨펌 종료 시).
    // 색은 기본색 — 프로필 케밥 메뉴와 동일 (RN AnchoredActionMenu 원칙: 위험 액션도 기본색)
    items.push({
      label: '차단하기',
      icon: <IconBlock width={20} height={20} className="text-gray-600" />,
      onSelect: () => setBlockConfirmOpen(true),
    });
  }

  // 차단 컨펌·성공 스낵바 — UserProfileDialog handleBlockConfirm과 동일 카피
  // (프로필 경유 차단은 항상 관리 화면 힌트 — RN useBlockConfirm 패리티)
  const handleBlockConfirm = () => {
    blockMember(member, {
      onSuccess: () => {
        showSnackbar({ message: BLOCK_MESSAGES.blockManageHint });
      },
    });
    onClose();
  };

  // EM 신규 채팅 — 메뉴를 제목 입력 다이얼로그로 교체 (차단 컨펌과 동일 패턴)
  if (startMemberChat.emTitleDraft) {
    return (
      <StartEMTitleDialog
        draft={startMemberChat.emTitleDraft}
        onChangeTitle={startMemberChat.setEmDraftTitle}
        onConfirm={startMemberChat.confirmEmDraft}
        onCancel={onClose}
      />
    );
  }

  if (isBlockConfirmOpen) {
    return (
      <ConfirmDialog
        open
        title={`${member.name}님을 차단할까요?`}
        description={BLOCK_MESSAGES.blockConfirmDescription}
        confirmLabel="차단"
        cancelLabel="취소"
        neutral
        onConfirm={handleBlockConfirm}
        onCancel={onClose}
      />
    );
  }

  return <CursorMenu x={x} y={y} items={items} onClose={onClose} />;
}

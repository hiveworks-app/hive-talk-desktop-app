'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetEMLastMessage } from '@/features/chat-room/api';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useLeaveRoom } from '@/features/chat-room-list/useLeaveRoom';
import { EM_LAST_MESSAGE_KEY } from '@/shared/config/queryKeys';
import { LEAVE_CONFIRM_DESCRIPTION } from '@/shared/config/constants';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { cn } from '@/shared/lib/cn';
import { countRoomListTotalUsers } from '@/shared/utils/roomUserCount';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { formatChatTimestamp } from '@/shared/utils/formatTimeUtils';
import { Badge } from '@/shared/ui/Badge';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { CursorMenu } from '@/shared/ui/CursorMenu';
import { GroupProfileAvatar, type GroupAvatarUser } from '@/shared/ui/GroupProfileAvatar';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';
import { IconCaution, IconChatDraft } from '@assets/icons';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import IconLeave from '@assets/icons/leave.svg';
import IconBottomChatDefault from '@assets/icons/bottom-chat-default.svg';
import { emRoomFavoriteRank, NO_PIN_RANK } from './chatRoomListUtils';

/** 협력채팅(EM) 목록 행 — 사이드바·검색 오버레이 공용 (사내 ChatRoomItem 분리 구조와 동일) */
interface EMRoomItemProps {
  /** ★ 표시 여부 — 관심멤버순 정렬일 때만 (RN showFavoriteStar 패리티) */
  showFavoriteStar?: boolean;
  room: GetChatRoomListItemType;
  myUserId?: string;
  pinnedRankMap: Map<string, number>;
}

export function EMRoomItem({ room, myUserId, pinnedRankMap, showFavoriteStar = false }: EMRoomItemProps) {
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
  const hasPinned = showFavoriteStar && emRoomFavoriteRank(room, pinnedRankMap) !== NO_PIN_RANK;

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
      // RN 패리티 — 나가기 컨펌 타이틀 옆 인원수 (EM participants는 본인 포함)
      titleSuffix={String(countRoomListTotalUsers(WS_CHANNEL_TYPE.EXTERNAL_MESSAGE, roomModel.participants))}
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

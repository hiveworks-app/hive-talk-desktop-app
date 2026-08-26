"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAppRouter } from "@/shared/hooks/useAppRouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiGetDMLastMessage,
  apiGetGMLastMessage,
} from "@/features/chat-room/api";
import { GetChatRoomListItemType } from "@/features/chat-room-list/type";
import {
  DM_LAST_MESSAGE_KEY,
  GM_LAST_MESSAGE_KEY,
} from "@/shared/config/queryKeys";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/Badge";
import { GroupProfileAvatar, type GroupAvatarUser } from "@/shared/ui/GroupProfileAvatar";
import { ProfileCircle } from "@/shared/ui/ProfileCircle";
import { countDMTotalUsers, countRoomListTotalUsers } from '@/shared/utils/roomUserCount';
import {
  WS_CHANNEL_TYPE,
  WebSocketChannelTypes,
} from "@/shared/types/websocket";
import { getLastMessagePreview } from "@/shared/utils/chatUtils";
import { formatChatTimestamp } from "@/shared/utils/formatTimeUtils";
import { useChatRoomInfo } from "@/store/chat/chatRoomStore";
import { useBlockedMembersStore } from "@/store/blockedMembersStore";
import { useDraftStore } from "@/store/chat/draftStore";
import { useFailedMessagesStore } from "@/store/chat/failedMessagesStore";
import { useAuthStore } from "@/store/auth/authStore";
import { useLeaveRoom } from "@/features/chat-room-list/useLeaveRoom";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { CursorMenu } from "@/shared/ui/CursorMenu";
import { LEAVE_CONFIRM_DESCRIPTION } from "@/shared/config/constants";
import IconLeave from "@assets/icons/leave.svg";
import IconBottomChatDefault from "@assets/icons/bottom-chat-default.svg";
import IconCreateChatFilled from "@assets/icons/create-chat-filled.svg";
import IconStarFilled from "@assets/icons/star-filled.svg";
import { IconCaution, IconChatDraft } from "@assets/icons";

interface ChatRoomItemProps {
  room: GetChatRoomListItemType;
  channelType: WebSocketChannelTypes;
  /** 관심멤버 userId → 등록 순서 rank */
  pinnedRankMap: Map<string, number>;
  /** ★ 표시 여부 — 관심멤버순 정렬일 때만 부모에서 true 전달 (RN showFavoriteStar 패리티) */
  showFavoriteStar?: boolean;
}

export function ChatRoomItem({ room, channelType, pinnedRankMap, showFavoriteStar = false }: ChatRoomItemProps) {
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
  const time = lastMessage?.message.createdAt
    ? formatChatTimestamp(lastMessage.message.createdAt)
    : "";

  // DM은 상대 이름 우선 — 서버가 DM에 title을 채워도 상대 이름을 보여준다 (RN 패리티)
  const displayName =
    channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
      ? roomModel.participantDetail?.name || roomModel.title || "채팅방"
      : roomModel.title ||
        roomModel.participants?.map((p) => p.name).join(", ") ||
        "채팅방";

  const profileStorageKey =
    roomModel.participantDetail?.thumbnailProfileUrl ?? null;

  const myUserId = useAuthStore((s) => s.user?.id);
  const isGM = channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE;
  // 본인 제외 참여자 (이름순, 최대 4명) — GM 그룹 아바타 (정책 chat.md, RN ChatListProfileAvatar 대응)
  const otherParticipants = (roomModel.participants ?? [])
    .filter((p) => String(p.userId) !== String(myUserId))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const avatarUsers: GroupAvatarUser[] = otherParticipants
    .slice(0, 4)
    .map((p) => ({ name: p.name, storageKey: p.thumbnailProfileUrl }));
  // 혼자 남은 그룹방 → dimmed (RN GMChatListRenderItem isAlone 패리티)
  const isAloneGM = isGM && otherParticipants.length === 0;
  // ★는 관심멤버순 정렬일 때만, 관심멤버 포함 방에 표시 (RN isPinnedRoom 패리티 — DM은 상대 기준)
  const isPinnedRoom =
    channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
      ? roomModel.participantDetail?.userId != null &&
        pinnedRankMap.has(String(roomModel.participantDetail.userId))
      : (roomModel.participants ?? []).some((p) => pinnedRankMap.has(String(p.userId)));
  const hasPinned = showFavoriteStar && isPinnedRoom;

  const isActive = params?.roomId === roomModel.roomId;
  // 멀티 채팅창(새 창에서 열기)은 Electron 전용
  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron);

  // 개별 나가기 (hover 액션 — RN 스와이프 나가기 대응)
  const { leaveRoom } = useLeaveRoom();
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // 우클릭 컨텍스트 메뉴 (데스크톱 관례) — 커서 좌표
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleClick = async () => {
    if (isActive) return;

    const lastMessageQueryKey =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? DM_LAST_MESSAGE_KEY(roomModel.roomId)
        : GM_LAST_MESSAGE_KEY(roomModel.roomId);

    const lastMessageApi =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? apiGetDMLastMessage
        : apiGetGMLastMessage;

    const lastMsg =
      lastMessage ??
      (await queryClient
        .fetchQuery({
          queryKey: lastMessageQueryKey,
          queryFn: () =>
            lastMessageApi(roomModel.roomId).then((r) => r.payload),
          staleTime: 1000 * 60 * 5,
        })
        .catch(() => null));

    const isOtherUserExit = roomModel.participantDetail?.isExit ?? false;
    // GM 목록 participants는 본인 제외(+1 필요) — 단일 유틸 강제 (RN roomUserCount 패리티)
    const totalUserCount =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? countDMTotalUsers(isOtherUserExit)
        : countRoomListTotalUsers(channelType, roomModel.participants);

    const invitedUserIds =
      channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE &&
      isOtherUserExit &&
      roomModel.participantDetail?.userId
        ? [String(roomModel.participantDetail.userId)]
        : [];

    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: roomModel.roomId,
      roomName: displayName,
      channelType,
      totalUserCount,
      otherUserIsExit: isOtherUserExit,
      // 방 스코프 플래그 — partial merge라 미지정 시 이전 방 값이 잔존하므로 명시 재설정 (RN 교훈)
      otherUserIsRemoved:
        channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
          ? (roomModel.participantDetail?.isRemoved ?? false)
          : false,
      lastMessage: lastMsg ?? null,
      invitedUserIds,
      initialNotReadCount: notReadCount,
    });

    router.push(`/chat/${roomModel.roomId}`);
  };

  // 상대가 회원탈퇴/소속해제로 제거된 DM 또는 혼자 남은 GM — 연한 색 처리 (정책 dm.md/chat.md)
  const isDimmed =
    (channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE &&
      roomModel.participantDetail?.isRemoved === true) ||
    isAloneGM;

  return (
    <div className="group relative">
    <button
      onClick={handleClick}
      onContextMenu={e => {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors group-hover:bg-gray-150",
        isActive && "bg-gray-150",
      )}
    >
      {/* 아바타 — GM은 참여자 조합 그룹 아바타 (RN ChatListProfileAvatar 대응).
          dimmed는 RN 패리티로 행 전체 opacity가 아닌 아바타 white/70 오버레이 + 텍스트 gray-400 */}
      <div className="relative shrink-0">
        {isGM && avatarUsers.length > 0 ? (
          <GroupProfileAvatar users={avatarUsers} />
        ) : (
          <ProfileCircle name={displayName} size="lg" storageKey={profileStorageKey} />
        )}
        {isDimmed && <div className="pointer-events-none absolute inset-0 rounded-full bg-white/70" />}
      </div>

      {/* 컨텐츠 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <span className={cn("truncate text-body font-medium", isDimmed ? "text-gray-400" : "text-text-primary")}>
              {displayName}
            </span>
            {/* 관심멤버(★) — 관심멤버순 정렬일 때만 (RN 패리티) */}
            {hasPinned && (
              <IconStarFilled width={16} height={16} className="shrink-0 text-gray-400" />
            )}
          </div>
          {/* 시간 — 12px 직접 지정 (사용자 조정 2026-08-20, sub-xs 토큰 HMR 이슈로 arbitrary 사용) */}
          <span className={cn("shrink-0 text-[12px] leading-[15px]", isDimmed ? "text-gray-400" : "text-gray-500")}>
            {time}
          </span>
        </div>
        <div className="flex items-start gap-2">
          {/* 미리보기: 최대 2줄 ···. 우측 최대 뱃지 폭(min-w-[54px] — RN 거터) 고정으로
              뱃지 유무와 무관하게 텍스트 우측 경계를 일정하게 유지 (정책 chat.md:10) */}
          <span className={cn("line-clamp-2 min-w-0 flex-1 text-sub-sm", isDimmed ? "text-gray-400" : "text-text-secondary")}>
            {preview}
          </span>
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
          // 멀티 채팅창 — Electron에서만, 보고 있는 방은 제외 (같은 방이 메인 창+팝업으로 이중 표시되는 것 방지. 이미 연 팝업은 main의 openChatWindow가 기존 창 포커스로 중복 방지)
          ...(isElectron && !isActive ? [{
            label: '새 창에서 열기',
            icon: <IconCreateChatFilled width={20} height={20} className="text-gray-600" />,
            onSelect: () => {
              setMenuPos(null);
              (window as unknown as { electronAPI?: { openChatWindow?: (d: { path: string; roomId: string }) => void } })
                .electronAPI?.openChatWindow?.({ path: `/chat-popup/${roomModel.roomId}`, roomId: roomModel.roomId });
            },
          }] : []),
          { label: '나가기', icon: <IconLeave width={20} height={20} />, danger: true, onSelect: () => { setMenuPos(null); setLeaveConfirmOpen(true); } },
        ]}
        onClose={() => setMenuPos(null)}
      />
    )}

    <ConfirmDialog
      open={isLeaveConfirmOpen}
      title={displayName}
      // RN 패리티 — GM은 타이틀 옆 인원수 표기
      titleSuffix={
        channelType !== WS_CHANNEL_TYPE.DIRECT_MESSAGE
          ? String(countRoomListTotalUsers(channelType, roomModel.participants))
          : undefined
      }
      description={
        channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
          ? LEAVE_CONFIRM_DESCRIPTION.SIMPLE
          : LEAVE_CONFIRM_DESCRIPTION.GROUP
      }
      confirmLabel="나가기"
      cancelLabel="취소"
      destructive
      onConfirm={() => {
        setLeaveConfirmOpen(false);
        leaveRoom(roomModel.roomId, channelType);
      }}
      onCancel={() => setLeaveConfirmOpen(false)}
    />
    </div>
  );
}

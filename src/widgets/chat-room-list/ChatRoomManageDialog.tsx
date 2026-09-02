'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useRoomIdParam } from '@/shared/hooks/useRoomIdParam';
import { useGetEMRoomList } from '@/features/chat-room-list/queries';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { getLastMessagePreview } from '@/shared/utils/chatUtils';
import { apiBatchExitRooms } from '@/features/chat-room-list/api';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/auth/authStore';
import { ChatRoomManageOverlay, type ManageRoomEntry } from './ChatRoomManageOverlay';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';

interface ChatRoomManageDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 협력채팅(EM) 채팅방 관리 모달 — 공용 오버레이에 EM 데이터/나가기 로직 주입.
 */
export function ChatRoomManageDialog({ open, onClose }: ChatRoomManageDialogProps) {
  const { data: emRooms = [] } = useGetEMRoomList();
  const myUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const router = useAppRouter();
  const currentRoomId = useRoomIdParam();
  const queryClient = useQueryClient();

  // 최신순 정렬 (RN ChatRoomManagementScreen 패리티 — 사내 방 관리와 동일 기준: sortAt 우선)
  const lastActivityMs = (room: (typeof emRooms)[number]) =>
    Date.parse(room.sortAt ?? room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? '') || 0;
  const rooms: ManageRoomEntry[] = [...emRooms]
    .sort((a, b) => lastActivityMs(b) - lastActivityMs(a))
    .map(room => {
    const others = (room.roomModel.participants ?? [])
      .filter(p => String(p.userId) !== String(myUserId))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return {
      roomId: room.roomModel.roomId,
      displayName: room.roomModel.title || others.map(p => p.name).join(', ') || '채팅방',
      avatarUsers: others.slice(0, 4).map(p => ({ name: p.name, storageKey: p.thumbnailProfileUrl })),
      preview: getLastMessagePreview(room.messageList[0] ?? null),
    };
  });

  const handleLeave = (ids: string[]) => {
    ids.forEach(roomId => {
      // 나간 방의 드래프트·실패 메시지 정리 (RN 패리티)
      useDraftStore.getState().clearDraft(roomId);
      useFailedMessagesStore.getState().removeRoom(roomId);
      // REST 나가기는 WS EXIT ack가 없어 팝업 닫기 체인이 끊긴다 — 명시적으로 해당 방 팝업 닫기
      (window as unknown as { electronAPI?: { closeChatWindow?: (id: string) => void } })
        .electronAPI?.closeChatWindow?.(roomId);
    });

    // 내가 나갈 땐 WS가 목록을 갱신하지 않으므로 캐시에서 낙관적 제거
    const sel = new Set(ids);
    queryClient.setQueryData<GetChatRoomListItemType[]>(
      EM_ROOM_LIST_KEY,
      prev => prev?.filter(r => !sel.has(r.roomModel.roomId)) ?? [],
    );

    // 일괄 나가기는 전용 REST (RN 패리티) — 실패 시 invalidate 롤백
    void apiBatchExitRooms({ dmRoomIds: [], gmRoomIds: [], emRoomIds: ids }).catch(err => {
      console.warn('[ChatRoomMgmt] EM 일괄 나가기 API 실패 → 목록 재조회 롤백:', err);
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    });

    if (currentRoomId && sel.has(currentRoomId)) router.push('/external-chat');

    showSnackbar({ message: `${ids.length}개 채팅방을 나갔어요.`, state: 'success' });
  };

  return (
    <ChatRoomManageOverlay
      open={open}
      onClose={onClose}
      rooms={rooms}
      onLeave={handleLeave}
      leaveNotice="나가면 다시 초대받아야 입장할 수 있어요."
    />
  );
}

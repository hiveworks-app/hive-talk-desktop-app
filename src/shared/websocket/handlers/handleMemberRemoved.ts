import { DM_ROOM_LIST_KEY, MEMBERS_KEY, PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import type { MessageHandlerDeps } from './types';

/**
 * 👋 전역 스코프 사내멤버 제거 ({BROADCAST|INIT}/COMPANY/MEMBER_REMOVED).
 * 회원탈퇴/소속해제 → 멤버 목록·관심멤버 재조회로 정리 (RN applyCompanyMemberRemoved 패리티).
 */
export function applyCompanyMemberRemoved(deps: MessageHandlerDeps) {
  deps.queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
  deps.queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
}

/**
 * 👋 방 스코프 DM 멤버 제거 ({BROADCAST|INIT}/MEMBER_REMOVED/DIRECT_MESSAGE).
 * 해당 DM 방의 participantDetail.isRemoved 마킹 + 현재 진입 중인 방이면 입력바 즉시 비활성.
 * userId 대조 후에만 마킹 — 엉뚱한 방 오염 방지 (RN applyDmMemberRemoved 패리티).
 */
export function applyDmMemberRemoved(
  roomId: string,
  removedUserId: string,
  deps: MessageHandlerDeps,
) {
  deps.queryClient.setQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY, prev =>
    prev?.map(room => {
      if (room.roomModel.roomId !== roomId) return room;
      const detail = room.roomModel.participantDetail;
      if (!detail || String(detail.userId) !== removedUserId) return room;
      return {
        ...room,
        roomModel: { ...room.roomModel, participantDetail: { ...detail, isRemoved: true } },
      };
    }) ?? [],
  );

  if (useChatRoomInfo.getState().roomId === roomId) {
    useChatRoomInfo.getState().setChatRoomInfo({ otherUserIsRemoved: true });
  }
}

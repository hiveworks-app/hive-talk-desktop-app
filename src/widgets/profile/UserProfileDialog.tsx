'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDM } from '@/features/create-chat-room/queries';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { isApiError } from '@/shared/api';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberItem | null;
}

export function UserProfileDialog({ isOpen, onClose, member }: UserProfileDialogProps) {
  useDimmed(isOpen);
  const router = useRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(state => state.showSnackbar);
  const myUserId = useAuthStore(s => s.user?.id);
  const { mutateAsync: createDM, isPending } = useCreateDM();

  if (!isOpen || !member) return null;

  const isMe = member.userId === myUserId;

  const phone =
    member.phoneHead && member.phoneMid && member.phoneTail
      ? `${member.phoneHead}-${member.phoneMid}-${member.phoneTail}`
      : null;

  const navigateToRoom = (
    roomId: string,
    lastMessage: WebSocketPublishItem | null = null,
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
    onClose();
    router.push(`/chat/${roomId}`);
  };

  const findExistingRoom = () => {
    const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
    return dmRooms.find(room => {
      const uid = String(member.userId);
      if (String(room.roomModel.participantDetail?.userId) === uid) return true;
      return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
    });
  };

  const handleStartDM = async () => {
    if (isMe || isPending) return;

    // 캐시에서 기존 방 확인
    const existing = findExistingRoom();
    if (existing) {
      navigateToRoom(existing.roomModel.roomId, existing.messageList[0] ?? null);
      return;
    }

    try {
      const res = await createDM(member.userId);
      // invitedUserIds 설정 → 첫 메시지 전송 시 INVITE 발송 (모바일 패턴)
      navigateToRoom(res.payload.roomId, null, [member.userId]);
    } catch (err) {
      if (!isApiError(err)) {
        showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
        return;
      }

      // 409 Conflict: 이미 존재하는 방 → 목록 새로 조회 후 이동
      await queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
      const refetched = findExistingRoom();
      if (refetched) {
        navigateToRoom(refetched.roomModel.roomId, refetched.messageList[0] ?? null);
        showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
      } else {
        showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[360px] rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-heading-sm font-bold text-text-primary">프로필</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* 아바타 + 이름 */}
          <div className="flex flex-col items-center gap-3 pb-5">
            <ProfileCircle
              name={member.name}
              storageKey={member.profileUrl || member.thumbnailProfileUrl}
              className="h-20 w-20"
            />
            <div className="text-center">
              <div className="text-heading-md font-bold text-text-primary">{member.name}</div>
              <div className="text-sub text-text-secondary">{member.email}</div>
            </div>
          </div>

          {/* 정보 */}
          <div className="space-y-3 border-t border-divider pt-4">
            {member.department && (
              <InfoRow label="부서" value={member.department} />
            )}
            {member.job && (
              <InfoRow label="직책" value={member.job} />
            )}
            {phone && (
              <InfoRow label="전화번호" value={phone} />
            )}
            {member.companyName && (
              <InfoRow label="회사" value={member.companyName} />
            )}
          </div>

          {/* 1:1 채팅 버튼 */}
          {!isMe && (
            <button
              onClick={handleStartDM}
              disabled={isPending}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled"
            >
              {isPending ? '생성 중...' : '1:1 채팅 시작'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub text-text-tertiary">{label}</span>
      <span className="text-sub text-text-primary">{value}</span>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCreateDM } from '@/features/create-chat-room/queries';
import { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberItem | null;
}

export function UserProfileDialog({ isOpen, onClose, member }: UserProfileDialogProps) {
  const router = useRouter();
  const myUserId = useAuthStore(s => s.user?.id);
  const { mutateAsync: createDM, isPending } = useCreateDM();

  if (!isOpen || !member) return null;

  const isMe = member.userId === myUserId;

  const phone =
    member.phoneHead && member.phoneMid && member.phoneTail
      ? `${member.phoneHead}-${member.phoneMid}-${member.phoneTail}`
      : null;

  const handleStartDM = async () => {
    if (isMe || isPending) return;

    const res = await createDM(member.userId);
    const { roomId } = res.payload;

    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName: member.name,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
    });

    onClose();
    router.push(`/chat/${roomId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[360px] rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-base font-bold text-text-primary">프로필</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* 아바타 + 이름 */}
          <div className="flex flex-col items-center gap-3 pb-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-2xl font-bold text-text-secondary">
              {member.profilePresignedUrl || member.profileUrl ? (
                <img
                  src={member.profilePresignedUrl || member.profileUrl || ''}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                member.name.charAt(0)
              )}
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-text-primary">{member.name}</div>
              <div className="text-sm text-text-secondary">{member.email}</div>
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
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled"
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
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

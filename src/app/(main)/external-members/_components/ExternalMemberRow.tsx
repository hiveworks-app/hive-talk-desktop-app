'use client';

import { useCancelExternalInvite } from '@/features/external-member/queries';
import type { ExternalInviteStatus, ExternalMemberItem } from '@/features/external-member/type';
import { cn } from '@/shared/lib/cn';

const STATUS_LABEL: Record<ExternalInviteStatus, { text: string; className: string }> = {
  PENDING: { text: '대기중', className: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { text: '수락됨', className: 'bg-green-100 text-green-700' },
  EXPIRED: { text: '만료됨', className: 'bg-gray-100 text-gray-500' },
};

interface ExternalMemberRowProps {
  member: ExternalMemberItem;
}

export function ExternalMemberRow({ member }: ExternalMemberRowProps) {
  const { mutateAsync: cancel, isPending } = useCancelExternalInvite();
  const status = STATUS_LABEL[member.inviteStatus];

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sub font-medium text-text-secondary">
        {member.thumbnailProfileUrl ? (
          <img
            src={member.thumbnailProfileUrl}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          member.name.charAt(0)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sub font-medium text-text-primary">{member.name}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
            {status.text}
          </span>
        </div>
        <div className="text-sub-sm text-text-tertiary">
          {member.email}
          {member.joinedRoomCount > 0 && (
            <span className="ml-2">참여 채팅방 {member.joinedRoomCount}개</span>
          )}
        </div>
      </div>
      {member.inviteStatus === 'PENDING' && (
        <button
          onClick={() => cancel(member.userId)}
          disabled={isPending}
          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-sub-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          {isPending ? '취소중' : '취소'}
        </button>
      )}
    </div>
  );
}

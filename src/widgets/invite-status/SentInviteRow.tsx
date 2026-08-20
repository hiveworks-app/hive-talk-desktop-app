'use client';

import { cn } from '@/shared/lib/cn';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { SentInviteItem } from '@/features/external-member/type';

/** N일전 계산 (날짜 기준, 시간 무시) — 모바일 SentInviteListItem 패리티 */
function getRelativeTime(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  return `${days}일전`;
}

/** 상태별 배지 스타일 (PENDING=초대중, ACCEPTED=수락, 그 외=만료) */
function getStatusStyle(status: string): { className: string; label: string } {
  if (status === 'PENDING') return { className: 'bg-green-100 text-green-700', label: '초대중' };
  if (status === 'ACCEPTED') return { className: 'bg-blue-100 text-blue-500', label: '수락' };
  return { className: 'bg-gray-100 text-gray-600', label: '만료' };
}

interface SentInviteRowProps {
  invite: SentInviteItem;
}

export function SentInviteRow({ invite }: SentInviteRowProps) {
  const { className, label } = getStatusStyle(invite.status);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      {/* 아바타 40px — 받은 초대 행과 동일 (RN ProfileImage small) */}
      <ProfileCircle name={invite.name} size="sm" storageKey={invite.profileUrl} />
      <span className="min-w-0 flex-1 truncate text-body text-gray-900">
        {invite.name}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-sub-sm text-gray-600">{getRelativeTime(invite.sentAt)}</span>
        <span className={cn('rounded-full px-3.5 py-1.5 text-sub font-medium', className)}>
          {label}
        </span>
      </div>
    </div>
  );
}

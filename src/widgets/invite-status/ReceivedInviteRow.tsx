'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { ReceivedInviteItem } from '@/features/external-member/type';

interface ReceivedInviteRowProps {
  invite: ReceivedInviteItem;
  /** [응답하기] 클릭 — 상위(초대현황 화면)가 응답 바텀시트를 연다 (RN 구조 동일) */
  onRespond: () => void;
}

/**
 * 받은 초대 행 (RN InviteListItem 패리티).
 * 아바타 40 · 이름(text-body, 길면 말줄임) · 회사명(sub-sm gray-600, flex-1 스페이서) · [응답하기].
 */
export function ReceivedInviteRow({ invite, onRespond }: ReceivedInviteRowProps) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <ProfileCircle name={invite.name} size="sm" storageKey={invite.profileUrl} />
      {/* 이름 — shrink로 긴 이름만 잘림 (버튼은 밀리지 않음) */}
      <span className="min-w-0 shrink truncate text-body text-gray-900">{invite.name}</span>
      {/* 회사명 — flex-1 스페이서 겸용: 버튼을 우측으로 밀어준다 */}
      <span className="min-w-0 flex-1 truncate text-sub-sm text-gray-600">{invite.companyName ?? ''}</span>
      <button
        type="button"
        onClick={onRespond}
        className="h-8 shrink-0 rounded-md bg-blue-100 px-3 text-sub font-medium text-blue-500 transition-opacity hover:opacity-70 active:opacity-60"
      >
        응답하기
      </button>
    </div>
  );
}

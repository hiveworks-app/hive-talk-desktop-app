'use client';

import { useState } from 'react';
import {
  useReceivedInvites,
  useSentInvites,
  useRespondInvite,
} from '@/features/external-member/queries';
import { cn } from '@/shared/lib/cn';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { IconClose } from '@/shared/ui/icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { ReceivedInviteRow } from './ReceivedInviteRow';
import { SentInviteRow } from './SentInviteRow';

interface InviteStatusDialogProps {
  open: boolean;
  onClose: () => void;
}

type StatusTab = 'received' | 'sent';

const tabClass = (active: boolean) =>
  cn(
    'flex-1 border-b-2 pb-2.5 text-sub font-medium transition-colors',
    active
      ? 'border-primary text-text-primary'
      : 'border-transparent text-text-tertiary hover:text-text-secondary',
  );

/**
 * 초대현황 화면 (멤버목록 편지봉투 진입점).
 * GUEST는 초대를 보낼 수 없어 '보낸 초대'가 없으므로 탭 없이 받은 초대만 표시한다.
 * 채팅방 생성(CreateRoomDialog)과 동일한 전체화면(풀필) 패턴 — 딤+중앙 모달이 아닌 창 전체를 덮는다.
 * (RN InviteStatusScreen 패리티 — 모바일 전체화면 그대로)
 */
export function InviteStatusDialog({ open, onClose }: InviteStatusDialogProps) {
  useDimmed(open);
  const isOrgMember = useAuthStore(s => s.user?.userType) === USER_TYPE.ORG_MEMBER;
  const [activeTab, setActiveTab] = useState<StatusTab>('received');

  const { data: receivedInvites = [], isLoading: isReceivedLoading } = useReceivedInvites();
  const { data: sentInvites = [], isLoading: isSentLoading } = useSentInvites();
  const { mutate: respondInvite, isPending: isResponding } = useRespondInvite();

  // 소속 유저만 탭(받은/보낸) — GUEST는 받은 초대만
  const tab = isOrgMember ? activeTab : 'received';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full flex-col bg-white">
        {/* macOS 신호등(좌상단 창 버튼) 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {/* 헤더: 초대현황(좌) / X(우) — 다른 모달과 닫기 버튼 위치 통일 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-3.5 pt-1">
          <h2 className="text-base font-bold text-gray-900">초대현황</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-gray-500 hover:text-gray-900">
            <IconClose size={20} />
          </button>
        </div>

        {isOrgMember ? (
          <div className="flex border-b border-gray-100 px-4 pt-3">
            <button onClick={() => setActiveTab('received')} className={tabClass(tab === 'received')}>
              받은 초대 ({receivedInvites.length})
            </button>
            <button onClick={() => setActiveTab('sent')} className={tabClass(tab === 'sent')}>
              보낸 초대 ({sentInvites.length})
            </button>
          </div>
        ) : (
          <div className="px-4 pb-1 pt-3">
            <span className="text-sub-sm text-text-secondary">받은 초대 ({receivedInvites.length})</span>
          </div>
        )}

        <div className="scrollbar-thin flex-1 overflow-y-auto py-2">
          {tab === 'received' ? (
            isReceivedLoading ? (
              <Loading />
            ) : receivedInvites.length > 0 ? (
              receivedInvites.map(invite => (
                <ReceivedInviteRow
                  key={invite.inviteId}
                  invite={invite}
                  disabled={isResponding}
                  onAccept={() => respondInvite({ inviteId: invite.inviteId, result: 'ACCEPT' })}
                  onReject={() => respondInvite({ inviteId: invite.inviteId, result: 'REJECTED' })}
                />
              ))
            ) : (
              <EmptyState message="받은 초대가 없어요." />
            )
          ) : isSentLoading ? (
            <Loading />
          ) : sentInvites.length > 0 ? (
            sentInvites.map(invite => <SentInviteRow key={invite.inviteId} invite={invite} />)
          ) : (
            <EmptyState message="보낸 초대가 없어요." />
          )}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-10">
      <span className="text-sub-sm text-text-tertiary">로딩 중...</span>
    </div>
  );
}

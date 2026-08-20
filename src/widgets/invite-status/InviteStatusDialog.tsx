'use client';

import { useRef, useState } from 'react';
import {
  useReceivedInvites,
  useSentInvites,
  useRespondInvite,
} from '@/features/external-member/queries';
import { cn } from '@/shared/lib/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import type { ReceivedInviteItem } from '@/features/external-member/type';
import { ProfileDialogShell } from '@/widgets/profile/ProfileDialogShell';
import { ReceivedInviteRow } from './ReceivedInviteRow';
import { SentInviteRow } from './SentInviteRow';
import { InviteRespondDialog } from './InviteRespondDialog';

interface InviteStatusDialogProps {
  open: boolean;
  onClose: () => void;
}

type StatusTab = 'received' | 'sent';

// RN InviteStatusTabBar 패리티 — 활성 bg-blue-500+흰 글자 / 비활성 흰 배경+border-b gray-200+gray-600
const tabClass = (active: boolean) =>
  cn(
    'flex-1 rounded-t-[10px] px-4 py-2.5 text-body font-medium transition-colors',
    active
      ? 'bg-primary text-on-primary'
      : 'border-b border-gray-200 bg-white text-gray-600 hover:opacity-70 active:opacity-60',
  );

/**
 * 초대현황 풀스크린 화면 (RN InviteStatusScreen 패리티).
 * 헤더: ✕(좌) · "초대현황"(중앙) — gray-50 배경 + 흰 rounded-t-2xl 카드.
 * GUEST는 초대를 보낼 수 없어 탭 없이 받은 초대만 표시한다.
 * [응답하기] → 중앙 다이얼로그(InviteRespondDialog)에서 수락/거절 즉시 실행 (2차 컨펌 없음).
 */
export function InviteStatusDialog({ open, onClose }: InviteStatusDialogProps) {
  if (!open) return null;
  return <InviteStatusScreen onClose={onClose} />;
}

function InviteStatusScreen({ onClose }: { onClose: () => void }) {
  const isOrgMember = useAuthStore(s => s.user?.userType) === USER_TYPE.ORG_MEMBER;
  const [activeTab, setActiveTab] = useState<StatusTab>('received');

  const { data: receivedInvites = [], isLoading: isReceivedLoading } = useReceivedInvites();
  const { data: sentInvites = [], isLoading: isSentLoading } = useSentInvites();
  const { mutateAsync: respondInvite } = useRespondInvite();

  // 응답 시트 대상 + 진행 중 액션 (RN InviteStatusScreen selectedInvite/respondingAction 패리티)
  const [selectedInvite, setSelectedInvite] = useState<ReceivedInviteItem | null>(null);
  const [respondingAction, setRespondingAction] = useState<'ACCEPT' | 'REJECTED' | null>(null);
  // 연타 방어 — 같은 프레임 다중 클릭이 setState를 모두 통과할 수 있어 ref로 차단 (RN 동일)
  const respondInFlightRef = useRef(false);

  const handleRespond = async (result: 'ACCEPT' | 'REJECTED') => {
    if (!selectedInvite?.inviteId || respondInFlightRef.current) return;
    respondInFlightRef.current = true;
    setRespondingAction(result);
    try {
      await respondInvite({ inviteId: selectedInvite.inviteId, result });
    } catch {
      // 에러 스낵바는 useRespondInvite onError에서 처리
    } finally {
      setRespondingAction(null);
      setSelectedInvite(null);
      respondInFlightRef.current = false;
    }
  };

  // 소속 유저만 탭(받은/보낸) — GUEST는 받은 초대만
  const tab = isOrgMember ? activeTab : 'received';
  const isLoading = tab === 'received' ? isReceivedLoading : isSentLoading;
  const count = tab === 'received' ? receivedInvites.length : sentInvites.length;

  return (
    <>
      <ProfileDialogShell title="초대현황" onClose={onClose} leftIcon="close">
        {isOrgMember && (
          <div className="flex">
            <button onClick={() => setActiveTab('received')} className={tabClass(tab === 'received')}>
              받은 초대
            </button>
            <button onClick={() => setActiveTab('sent')} className={tabClass(tab === 'sent')}>
              보낸 초대
            </button>
          </div>
        )}

        {/* 섹션 라벨 (RN — 라벨/카운트 두 텍스트 gap-1.5) */}
        <div className="flex gap-1.5 px-4 pb-0.5 pt-3.5">
          <span className="text-sub-sm text-gray-600">{tab === 'received' ? '받은 초대' : '보낸 초대'}</span>
          <span className="text-sub-sm text-gray-600">({count})</span>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-400" />
          </div>
        ) : count === 0 ? (
          <EmptyState
            message={tab === 'received' ? '받은 초대가 없어요.' : '보낸 초대가 없어요.'}
            className="flex-1"
          />
        ) : tab === 'received' ? (
          <div className="flex flex-col">
            {receivedInvites.map(invite => (
              <ReceivedInviteRow
                key={invite.inviteId}
                invite={invite}
                onRespond={() => setSelectedInvite(invite)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {sentInvites.map(invite => (
              <SentInviteRow key={invite.inviteId} invite={invite} />
            ))}
          </div>
        )}
      </ProfileDialogShell>

      {selectedInvite && (
        <InviteRespondDialog
          name={selectedInvite.name}
          respondingAction={respondingAction}
          onReject={() => void handleRespond('REJECTED')}
          onAccept={() => void handleRespond('ACCEPT')}
          onClose={() => setSelectedInvite(null)}
        />
      )}
    </>
  );
}

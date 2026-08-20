'use client';

import { cn } from '@/shared/lib/cn';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { ProfileDialogShell } from '@/widgets/profile/ProfileDialogShell';
import { useExternalInvite, type InviteTab } from '@/features/external-member/useExternalInvite';

interface ExternalInviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** 미등록 프로필 [멤버초대] 진입 — 대상 이메일을 미리 채워 재입력 없이 초대 (RN 패리티) */
  presetEmail?: string;
}

// 연락처 탭이 기본/좌측 (RN InviteTabBar 패리티)
const TABS: { key: InviteTab; label: string }[] = [
  { key: 'phone', label: '연락처로 추가' },
  { key: 'email', label: '이메일로 추가' },
];

/**
 * 멤버초대 풀스크린 화면 (RN MemberInviteScreen 패리티).
 * 헤더: ✕(좌) · "멤버초대"(중앙) · [확인](우 텍스트 버튼 — 검색→컨펌→초대 실행).
 * 성공 시 같은 화면 안에 InviteSuccessCard 표시, 입력 비활성 — 닫기는 ✕/ESC.
 * 열 때마다 마운트해 상태를 초기화한다 (RN 화면 push마다 새 상태와 동일).
 */
export function ExternalInviteDialog({ open, onClose, presetEmail }: ExternalInviteDialogProps) {
  if (!open) return null;
  return <MemberInviteScreen onClose={onClose} presetEmail={presetEmail} />;
}

function MemberInviteScreen({ onClose, presetEmail }: { onClose: () => void; presetEmail?: string }) {
  const {
    activeTab,
    inputValue,
    isDisabled,
    pendingInvite,
    inviteSuccess,
    handleInputChange,
    handleTabChange,
    handleConfirm,
    confirmInvite,
    cancelInvite,
  } = useExternalInvite({ presetEmail });

  // RN 패리티 — 컨펌 타이틀은 이름만 (회사명 미표기)
  const who = pendingInvite?.userName ?? '';

  return (
    <>
      <ProfileDialogShell
        title="멤버초대"
        onClose={onClose}
        leftIcon="close"
        headerRight={
          /* RN ScreenHeaderTextButton 패리티 — 활성 gray-900 / 비활성 #8B95A1 */
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isDisabled || !!inviteSuccess}
            className="px-1 text-heading-sm font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-text-tertiary"
          >
            확인
          </button>
        }
      >
        {/* RN InviteTabBar 패리티 — 활성 bg-blue-500+흰 글자 / 비활성 흰 배경+border-b gray-200+gray-600 */}
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex-1 rounded-t-[10px] px-4 py-2.5 text-body font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-on-primary'
                  : 'border-b border-gray-200 bg-white text-gray-600 hover:opacity-70 active:opacity-60',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 입력 (RN InputTextField h-48 패리티) — 초대 성공 후 비활성 */}
        <div className="p-4">
          <input
            key={activeTab}
            autoFocus
            value={inputValue}
            disabled={!!inviteSuccess}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleConfirm();
            }}
            placeholder={activeTab === 'phone' ? '연락처로 추가' : '이메일로 추가'}
            inputMode={activeTab === 'phone' ? 'numeric' : 'email'}
            autoComplete="off"
            className="h-10 w-full rounded-[10px] border border-gray-200 bg-white px-4 text-body text-gray-900 outline-none transition placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary disabled:bg-gray-50 disabled:text-text-disabled"
          />
        </div>

        {/* 초대 성공 카드 (RN InviteSuccessCard 패리티) — 입력 아래 같은 화면에 표시 */}
        {inviteSuccess && (
          <div className="flex w-full flex-col items-center gap-5">
            <div className="w-full px-4 pt-2.5">
              <div className="flex w-full flex-col items-center rounded-[14px] bg-gray-50 p-6">
                <div className="flex w-[280px] flex-col items-center gap-3">
                  <ProfileCircle
                    name={inviteSuccess.name}
                    size="lg"
                    storageKey={inviteSuccess.profileUrl ?? null}
                    className="h-[98px] w-[98px]"
                  />
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="flex flex-col items-center">
                      <span className="text-body font-semibold text-gray-900">{inviteSuccess.name}</span>
                      {inviteSuccess.company && (
                        <span className="text-sub-sm text-gray-600">{inviteSuccess.company}</span>
                      )}
                    </div>
                    <span className="text-center text-body text-gray-700">멤버 초대 요청되었어요.</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-blue-100 px-2.5 py-1.5">
              <span className="text-sub text-gray-700">상대방이 초대 수락시 멤버로 등록돼요.</span>
            </div>
          </div>
        )}
      </ProfileDialogShell>

      {/* 초대 확인 (RN showConfirm 카피 패리티) */}
      <ConfirmDialog
        open={pendingInvite !== null}
        title={`${who}님을 멤버로 초대할까요?`}
        description={
          <>
            상대방이 초대 수락 시 멤버로 등록돼요.
            <br />
            초대현황에서 초대내역을 확인할 수 있어요.
          </>
        }
        confirmLabel="초대"
        cancelLabel="취소"
        onConfirm={() => void confirmInvite()}
        onCancel={cancelInvite}
      />
    </>
  );
}

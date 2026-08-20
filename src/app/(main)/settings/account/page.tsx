'use client';

import { useState } from 'react';
import IconCardAccount from '@assets/icons/setting-card-account.svg';
import IconCardProfile from '@assets/icons/setting-card-profile.svg';
import IconIndicatorMore from '@assets/icons/indicator-more.svg';
import IconPhoneVerified from '@assets/icons/phone-verified.svg';
import { useGetCredentialInfo } from '@/features/profile/queries';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { formatMaskedPhone } from '@/shared/utils/phone';
import { useAuthStore } from '@/store/auth/authStore';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { SettingsOverlay } from '../_components/SettingsOverlay';

export default function AccountInfoPage() {
  const router = useAppRouter();
  const user = useAuthStore(s => s.user);
  const [showProfile, setShowProfile] = useState(false);

  // 휴대폰 인증 여부 — 로딩 중에는 깜빡임 방지를 위해 기본 인증 처리.
  const { data: credential } = useGetCredentialInfo();
  const isPhoneVerified = credential ? Boolean(credential.phoneVerifiedAt) : true;

  const maskedPhone = formatMaskedPhone(user?.phoneHead, user?.phoneMid, user?.phoneTail);
  const company = user?.organization?.organizationName ?? user?.companyName ?? '';
  const department = user?.organization?.departmentName ?? user?.department ?? '';
  const job = user?.job ?? '';

  return (
    <SettingsOverlay bg="bg-gray-50">
      {/* TopBar — 가운데 정렬 타이틀 + 우상단 닫기 */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        <h2 className="text-heading-md font-medium text-text-primary">하이브톡 계정정보</h2>
        <button
          onClick={() => router.push('/settings')}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="mx-auto flex max-w-[560px] flex-col gap-3.5">
          {/* 계정 정보 — RN 패리티: 카드 전체가 클릭 영역 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => router.push('/settings/account/detail')}
            onKeyDown={e => { if (e.key === 'Enter') router.push('/settings/account/detail'); }}
            className="cursor-pointer overflow-hidden rounded-xl border border-outline bg-surface transition-colors hover:bg-surface-pressed/40"
          >
            <CardHeader icon={<IconCardAccount className="h-5 w-5" />} title="계정 정보" />
            <InfoRow label="이메일" value={user?.email || '-'} />
            <InfoRow label="비밀번호" value="비공개" />
            <InfoRow
              label="휴대폰 번호"
              value={maskedPhone || '미등록'}
              verified={!!maskedPhone && isPhoneVerified}
            />
          </section>

          {/* 프로필 정보 — RN 패리티: 카드 전체가 클릭 영역 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => setShowProfile(true)}
            onKeyDown={e => { if (e.key === 'Enter') setShowProfile(true); }}
            className="cursor-pointer overflow-hidden rounded-xl border border-outline bg-surface transition-colors hover:bg-surface-pressed/40"
          >
            <CardHeader icon={<IconCardProfile className="h-5 w-5" />} title="프로필 정보" />
            <div className="flex items-center px-4 py-3.5">
              <span className="flex-1 text-body font-medium text-gray-800">프로필 사진</span>
              <ProfileCircle name={user?.name ?? ''} size="md" storageKey={user?.profileUrl} />
            </div>
            <InfoRow label="이름" value={user?.name || '-'} />
            <InfoRow label="회사" value={company || '-'} />
            <InfoRow label="부서" value={department || '-'} />
            <InfoRow label="직급" value={job || '-'} />
          </section>
        </div>
      </div>

      <MyProfileDialog isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </SettingsOverlay>
  );
}

function CardHeader({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 text-label font-semibold text-text-primary">{title}</span>
      <IconIndicatorMore width={16} height={16} className="shrink-0 text-gray-400" />
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 border-b border-outline px-4 py-3 text-left transition-colors hover:bg-surface-pressed"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex w-full items-center gap-2.5 border-b border-outline px-4 py-3">{inner}</div>;
}

function InfoRow({
  label,
  value,
  onClick,
  verified,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  verified?: boolean;
}) {
  const inner = (
    <>
      <span className="flex-1 shrink-0 text-body font-medium text-gray-800">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-body text-text-secondary">
        <span className="truncate">{value}</span>
        {verified && <IconPhoneVerified className="h-[18px] w-[18px] shrink-0" />}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-surface-pressed"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex w-full items-center px-4 py-3.5">{inner}</div>;
}

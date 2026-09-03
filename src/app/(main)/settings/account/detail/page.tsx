'use client';

import IconArrowBack from '@assets/icons/arrow_back.svg';
import IconIndicatorMore from '@assets/icons/indicator-more.svg';
import IconPhoneVerified from '@assets/icons/phone-verified.svg';
import { useGetCredentialInfo } from '@/features/profile/queries';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { formatDotDate } from '@/shared/utils/formatTimeUtils';
import { formatMaskedPhone } from '@/shared/utils/phone';
import { useAuthStore } from '@/store/auth/authStore';
import { SettingsOverlay } from '../../_components/SettingsOverlay';

export default function AccountDetailPage() {
  const router = useAppRouter();
  const user = useAuthStore(s => s.user);
  const { data: credential } = useGetCredentialInfo();

  const maskedPhone = formatMaskedPhone(user?.phoneHead, user?.phoneMid, user?.phoneTail);

  return (
    <SettingsOverlay bg="bg-background" onEscape={() => router.push('/settings/account')}>
      {/* TopBar — ←(하이브톡 계정정보로) / 중앙 타이틀 / X(전체설정으로) */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        <button
          onClick={() => router.push('/settings/account')}
          className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="뒤로가기"
        >
          <IconArrowBack width={20} height={20} />
        </button>
        <h2 className="text-heading-md font-medium text-text-primary">계정정보</h2>
        <button
          onClick={() => router.push('/settings')}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="mx-auto flex max-w-[480px] flex-col gap-7">
          <p className="text-heading-md font-medium text-text-primary">
            하이브톡 계정정보를
            <br />
            확인하고 변경할 수 있어요.
          </p>

          <div className="flex flex-col gap-3.5">
            <DetailCard
              title="이메일"
              value={user?.email || '-'}
              verifiedAt={credential?.emailVerifiedAt}
              onChange={() => router.push('/settings/email')}
            />
            <DetailCard
              title="비밀번호"
              value="비공개"
              verifiedAt={credential?.passwordChangedAt}
              onChange={() => router.push('/settings/password')}
            />
            <DetailCard
              title="휴대폰 번호"
              value={maskedPhone || '미등록'}
              verifiedAt={credential?.phoneVerifiedAt}
            />
          </div>
        </div>
      </div>
    </SettingsOverlay>
  );
}

function DetailCard({
  title,
  value,
  verifiedAt,
  onChange,
}: {
  title: string;
  value: string;
  verifiedAt?: string | null;
  onChange?: () => void;
}) {
  return (
    // 변경 가능한 카드는 본문까지 전체 클릭 (RN AccountDetailCard Pressable 패리티)
    <section
      onClick={onChange}
      className={`overflow-hidden rounded-xl border border-outline bg-surface ${onChange ? 'cursor-pointer transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : ''}`}
    >
      {/* 헤더: 제목 + (변경 가능 시) "변경 >" */}
      {onChange ? (
        <button
          onClick={e => {
            e.stopPropagation();
            onChange();
          }}
          className="flex w-full items-center gap-2.5 border-b border-outline px-4 py-3 text-left transition-colors hover:bg-surface-pressed"
        >
          <span className="flex-1 text-label font-semibold text-text-primary">{title}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-label text-text-tertiary">
            변경
            <IconIndicatorMore width={16} height={16} className="text-gray-400" />
          </span>
        </button>
      ) : (
        <div className="flex w-full items-center border-b border-outline px-4 py-3">
          <span className="flex-1 text-label font-semibold text-text-primary">{title}</span>
        </div>
      )}

      {/* 본문: 값 + 인증 시점 */}
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        <p className="text-body font-medium text-gray-800">{value}</p>
        {verifiedAt && (
          <span className="flex items-center gap-1 text-sub font-medium text-text-tertiary">
            {formatDotDate(verifiedAt)} 인증
            <IconPhoneVerified className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
    </section>
  );
}

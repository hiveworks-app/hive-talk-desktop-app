'use client';

import {
  useGetMyTerms,
  useToggleAdInfoConsent,
  useToggleMarketingConsent,
} from '@/features/terms/queries';
import { TERMS_CODE } from '@/features/terms/type';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { IconChevronLeft, IconChevronRight } from '@/shared/ui/icons';
import { Toggle } from '@/shared/ui/Toggle';
import { useUIStore } from '@/store';
import { SettingsOverlay } from '../_components/SettingsOverlay';

export default function PersonalSecurityPage() {
  const router = useAppRouter();
  const { showSnackbar } = useUIStore();

  const { data: terms } = useGetMyTerms();
  const marketing = useToggleMarketingConsent();
  const adInfo = useToggleAdInfoConsent();

  const isAgreed = (code: string) => terms?.items.find(i => i.code === code)?.isAgreed ?? false;
  const marketingAgreed = isAgreed(TERMS_CODE.MARKETING);
  const adAgreed = isAgreed(TERMS_CODE.AD_INFO);

  const handleToggle =
    (mutation: typeof marketing, label: string) => (next: boolean) =>
      mutation.mutate(next, {
        onSuccess: () =>
          showSnackbar({
            message: `${label}에 ${next ? '동의했습니다' : '동의를 철회했습니다'}.`,
            state: 'success',
          }),
        onError: () =>
          showSnackbar({ message: `${label} 변경에 실패했습니다.`, state: 'error' }),
      });

  return (
    <SettingsOverlay bg="bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button
          onClick={() => router.push('/settings')}
          className="electron-no-drag text-text-tertiary hover:text-text-secondary"
          aria-label="뒤로가기"
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">개인/보안</h2>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-[480px] space-y-6">
          {/* 동의 정보 (필수) */}
          <Section label="동의 정보 (필수)">
            <LinkRow
              title="하이브톡 서비스 이용약관"
              onClick={() => router.push('/settings/policy/terms-of-service')}
            />
            <LinkRow
              title="개인정보 수집·이용 동의"
              onClick={() => router.push('/settings/policy/privacy-consent')}
            />
          </Section>

          {/* 동의 정보 (선택) */}
          <Section label="동의 정보 (선택)">
            <ConsentToggleRow
              title="마케팅 목적 개인정보 이용 동의"
              checked={marketingAgreed}
              disabled={marketing.isPending}
              onChange={handleToggle(marketing, '마케팅 목적 개인정보 이용')}
              onViewFullText={() => router.push('/settings/policy/marketing-consent')}
            />
            <ConsentToggleRow
              title="광고성 정보 수신동의"
              checked={adAgreed}
              disabled={adInfo.isPending}
              onChange={handleToggle(adInfo, '광고성 정보 수신')}
              onViewFullText={() => router.push('/settings/policy/ad-consent')}
            />
          </Section>

          {/* 개인정보 관리 */}
          <Section label="개인정보 관리">
            <LinkRow title="하이브톡 탈퇴" danger onClick={() => router.push('/settings/withdrawal')} />
          </Section>
        </div>
      </div>
    </SettingsOverlay>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-sub-sm font-semibold uppercase text-text-tertiary">{label}</h3>
      <div className="overflow-hidden rounded-xl border border-divider bg-surface">{children}</div>
    </section>
  );
}

function LinkRow({
  title,
  onClick,
  danger,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between border-b border-divider px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-pressed"
    >
      <span className={`text-sub ${danger ? 'text-red-500' : 'text-text-primary'}`}>{title}</span>
      <IconChevronRight size={16} className={danger ? 'text-red-400' : 'text-text-tertiary'} />
    </button>
  );
}

function ConsentToggleRow({
  title,
  checked,
  disabled,
  onChange,
  onViewFullText,
}: {
  title: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  onViewFullText: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sub text-text-primary">{title}</span>
        <button
          onClick={onViewFullText}
          className="shrink-0 text-sub-sm text-text-tertiary underline hover:text-text-secondary"
        >
          전문
        </button>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import IconIndicatorMore from '@assets/icons/indicator-more.svg';
import {
  useGetMyTerms,
  useToggleAdInfoConsent,
  useToggleMarketingConsent,
} from '@/features/terms/queries';
import { TERMS_CODE } from '@/features/terms/type';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { Toggle } from '@/shared/ui/Toggle';
import { useUIStore } from '@/store';
import { SettingsOverlay } from '../_components/SettingsOverlay';
import {
  ConsentChangeDialog,
  type ConsentDialogAction,
  type ConsentDialogType,
} from '../_components/ConsentChangeDialog';

export default function PersonalSecurityPage() {
  const router = useAppRouter();
  const { showSnackbar } = useUIStore();

  const { data: terms, isPending: termsPending, refetch: refetchTerms } = useGetMyTerms();
  const marketing = useToggleMarketingConsent();
  const adInfo = useToggleAdInfoConsent();

  // 재진입/포커스 복귀 시 동의 상태 최신화 — 타 기기(모바일) 변경분 즉시 반영 (RN focus refetch 패리티)
  useEffect(() => {
    void refetchTerms();
    const onFocus = () => void refetchTerms();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetchTerms]);

  const isAgreed = (code: string) => terms?.items.find(i => i.code === code)?.isAgreed ?? false;
  const marketingAgreed = isAgreed(TERMS_CODE.MARKETING);
  const adAgreed = isAgreed(TERMS_CODE.AD_INFO);

  // 동의 변경 고지 다이얼로그 — 스낵바 대신 종류×액션별 카피 + 변경일자 모달 (RN 패리티)
  const [consentDialog, setConsentDialog] = useState<{
    type: ConsentDialogType;
    action: ConsentDialogAction;
    changedAt: Date;
  } | null>(null);

  const handleToggle =
    (mutation: typeof marketing, type: ConsentDialogType, label: string) => (next: boolean) =>
      mutation.mutate(next, {
        onSuccess: () =>
          setConsentDialog({ type, action: next ? 'agree' : 'revoke', changedAt: new Date() }),
        onError: () =>
          showSnackbar({ message: `${label} 변경에 실패했습니다.`, state: 'error' }),
      });

  return (
    <SettingsOverlay bg="bg-gray-50">
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        <h2 className="text-heading-md font-medium text-text-primary">개인/보안</h2>
        <button
          onClick={() => router.push('/settings')}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4 rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        <div className="mx-auto max-w-[480px] space-y-6">
          {/* 동의 정보 (필수) */}
          <Section label="동의 정보 (필수)">
            <LinkRow
              title="하이브톡 서비스 이용약관"
              onClick={() => router.push('/settings/policy?doc=terms-of-service')}
            />
            <LinkRow
              title="개인정보 수집·이용 동의"
              onClick={() => router.push('/settings/policy?doc=privacy-consent')}
            />
          </Section>

          {/* 동의 정보 (선택) */}
          <Section label="동의 정보 (선택)">
            <ConsentToggleRow
              title="마케팅 목적 개인정보 이용 동의"
              checked={marketingAgreed}
              loading={termsPending}
              disabled={marketing.isPending}
              onChange={handleToggle(marketing, 'marketing', '마케팅 목적 개인정보 이용')}
              onViewFullText={() => router.push('/settings/policy?doc=marketing-consent')}
            />
            <ConsentToggleRow
              title="광고성 정보 수신동의"
              checked={adAgreed}
              loading={termsPending}
              disabled={adInfo.isPending}
              onChange={handleToggle(adInfo, 'adInfo', '광고성 정보 수신')}
              onViewFullText={() => router.push('/settings/policy?doc=ad-consent')}
            />
          </Section>

          {/* 개인정보 관리 */}
          <Section label="개인정보 관리">
            <LinkRow title="하이브톡 탈퇴" onClick={() => router.push('/settings/withdrawal')} />
          </Section>
        </div>
      </div>

      {/* 동의 변경 고지 (RN ConsentChangeDialog 패리티) */}
      {consentDialog && (
        <ConsentChangeDialog
          open
          consentType={consentDialog.type}
          action={consentDialog.action}
          changedAt={consentDialog.changedAt}
          onClose={() => setConsentDialog(null)}
        />
      )}
    </SettingsOverlay>
  );
}

/* RN PersonalSecurityScreen 패리티 — 카드가 아닌 플랫 리스트 + 섹션 하단 구분선,
   라벨 sub medium gray-600, 행 제목 body(16) medium gray-800 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-divider pb-2 last:border-b-0">
      <h3 className="px-1 py-2 text-sub font-medium text-gray-600">{label}</h3>
      <div>{children}</div>
    </section>
  );
}

function LinkRow({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  // RN 패리티 — '하이브톡 탈퇴'도 중립색 (빨강 강조 없음)
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-1 py-3 text-left transition-colors hover:bg-surface-pressed"
    >
      <span className="text-body font-medium text-gray-800">{title}</span>
      <IconIndicatorMore width={16} height={16} className="text-gray-400" />
    </button>
  );
}

function ConsentToggleRow({
  title,
  checked,
  loading,
  disabled,
  onChange,
  onViewFullText,
}: {
  title: string;
  checked: boolean;
  /** 서버 동의 상태 도착 전 — OFF 기본값을 그렸다가 ON으로 뒤집히는 깜빡임 방지용 스켈레톤 표시 */
  loading: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  onViewFullText: () => void;
}) {
  // RN 패리티 — 제목 아래 별도 행에 밑줄 '전문보기'
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-gray-800">{title}</span>
        <button
          onClick={onViewFullText}
          className="mt-0.5 text-sub-sm text-text-tertiary underline transition-opacity hover:opacity-70 active:opacity-60"
        >
          전문보기
        </button>
      </div>
      {loading ? (
        <div className="h-6 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" aria-hidden />
      ) : (
        <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
      )}
    </div>
  );
}

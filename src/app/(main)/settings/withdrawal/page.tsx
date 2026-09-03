'use client';

import { useState } from 'react';
import IconArrowBack from '@assets/icons/arrow_back.svg';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { isWithdrawPasswordMismatch, useWithdrawAccount } from '@/features/withdrawal/queries';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Input } from '@/shared/ui/Input';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { useAuthStore } from '@/store/auth/authStore';
import { SettingsOverlay } from '../_components/SettingsOverlay';

const WITHDRAWAL_NOTICES = [
  '내 프로필, 멤버 목록 전체(관심멤버 포함), 대화 내용(사진·동영상·파일 등), 구독(결제) 등 사용자가 설정한 모든 정보가 사라지고 복구가 불가능합니다.',
  '참여 중인 모든 대화방에서 나가게 되고, 대화방에서 주고받은 사진·동영상·파일 등 모든 정보가 즉시 삭제됩니다. 중요한 정보는 탈퇴 전에 저장해 주세요.',
  '탈퇴 전에 구독 중인 결제 상품이 있는 경우 별도 해지해 주셔야 합니다.',
];

type Step = 'intro' | 'password';

export default function WithdrawalPage() {
  const router = useAppRouter();
  const userEmail = useAuthStore(s => s.user?.email) ?? '';
  const [step, setStep] = useState<Step>('intro');
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { mutate: withdraw, isPending } = useWithdrawAccount();

  // ←(이전 단계): 비밀번호 입력 → 안내. X(닫기): 개인/보안으로 나가기. 역할 분리.
  const stepBack = () => setStep('intro');
  // RN dismissAll 패리티 — X는 전체설정으로 복귀
  const close = () => router.push('/settings');

  const handleSubmit = () => {
    if (password.length === 0 || isPending) return;
    setPasswordError('');
    withdraw(
      { password },
      {
        // 가드 밖 완료 화면으로 이동 (RN 패리티·정책 settings.md "탈퇴 완료 후 로그인 이동").
        // 여기서 logout()까지 하면 (main) 가드 effect(토큰 소실 → /login)가 이 이동과 경합해
        // 완료 화면이 스킵된다 — 로컬 세션 정리는 완료 화면 마운트 시점에 수행 (2026-09-03)
        onSuccess: () => router.replace('/withdrawal-complete'),
        onError: err => {
          // 비밀번호 불일치(U016)만 인라인 에러로 표시. 그 외는 hook의 onError 스낵바가 처리.
          if (isWithdrawPasswordMismatch(err)) setPasswordError('입력한 비밀번호가 일치하지 않습니다.');
        },
      },
    );
  };

  return (
    <SettingsOverlay bg="bg-gray-50" onEscape={close}>
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        {step === 'password' && (
          <button
            onClick={stepBack}
            className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
            aria-label="이전 단계"
          >
            <IconArrowBack width={20} height={20} />
          </button>
        )}
        <h2 className="text-heading-md font-medium text-text-primary">하이브톡 탈퇴</h2>
        <button
          onClick={close}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        <div className="mx-auto max-w-[400px]">
          {step === 'intro' && (
            <div className="space-y-6">
              {/* RN AccountWithdrawalScreen 패리티 — 고지문 body(16) gray-700, 체크 라벨 heading-md medium + 24px 체크박스 */}
              <div>
                <h3 className="text-heading-md font-medium text-text-primary">하이브톡을 탈퇴하면</h3>
                <ul className="mt-4 space-y-4">
                  {WITHDRAWAL_NOTICES.map((notice, i) => (
                    <li key={i} className="flex gap-2 text-body text-gray-700">
                      <span aria-hidden>•</span>
                      <span className="flex-1">{notice}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setConfirmed(prev => !prev)}
                className="flex w-full items-start gap-2 text-left"
              >
                <span className="pt-0.5">
                  <Checkbox checked={confirmed} size="lg" />
                </span>
                <span className="flex-1 text-heading-md font-medium text-gray-900">
                  위 유의사항을 모두 확인했어요. 탈퇴를 진행할게요.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStep('password')}
                disabled={!confirmed}
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-body font-medium text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] active:bg-[var(--color-state-primary-pressed)] disabled:bg-gray-400 disabled:text-white"
              >
                하이브톡 탈퇴
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <h3 className="text-heading-lg font-semibold text-text-primary">비밀번호 확인</h3>
              <p className="text-sub text-text-secondary">본인 확인을 위해 비밀번호를 입력해 주세요.</p>

              <div className="rounded-lg border border-divider bg-surface px-4 py-3">
                <span className="text-sub-sm text-text-tertiary">로그인 이메일</span>
                <div className="mt-1 truncate text-sub font-medium text-text-primary">{userEmail || '-'}</div>
              </div>

              <div>
                {/* 공용 Input(lg 48px)으로 통일 — 수제 py 기반·비표준 색 입력 정리 (2026-09-03 전수 통일) */}
                <Input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  error={!!passwordError}
                />
                {passwordError && <p className="mt-1 text-sub-sm text-state-error">{passwordError}</p>}
              </div>

              {/* RN 패리티 — 실행 버튼도 primary blue 56px, disabled gray-400 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={password.length === 0 || isPending}
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-body font-medium text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] active:bg-[var(--color-state-primary-pressed)] disabled:bg-gray-400 disabled:text-white"
              >
                {isPending ? '처리 중...' : '인증 및 하이브톡 탈퇴하기'}
              </button>
            </div>
          )}

          {/* 탈퇴 완료 화면은 인증 가드 밖 별도 라우트(/withdrawal-complete)로 이동 —
              (main) 안에서 보여주면 세션 소멸에 따른 강제 로그아웃이 화면을 스킵한다 */}
        </div>
      </div>
    </SettingsOverlay>
  );
}

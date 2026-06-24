'use client';

import { useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { isWithdrawPasswordMismatch, useWithdrawAccount } from '@/features/withdrawal/queries';
import { Checkbox } from '@/shared/ui/Checkbox';
import { IconChevronLeft, IconClose } from '@/shared/ui/icons';
import { useAuthStore } from '@/store/auth/authStore';
import { SettingsOverlay } from '../_components/SettingsOverlay';

const WITHDRAWAL_NOTICES = [
  '내 프로필, 멤버 목록 전체(관심멤버 포함), 대화 내용(사진·동영상·파일 등), 구독(결제) 등 사용자가 설정한 모든 정보가 사라지고 복구가 불가능합니다.',
  '참여 중인 모든 대화방에서 나가게 되고, 대화방에서 주고받은 사진·동영상·파일 등 모든 정보가 즉시 삭제됩니다. 중요한 정보는 탈퇴 전에 저장해 주세요.',
  '탈퇴 전에 구독 중인 결제 상품이 있는 경우 별도 해지해 주셔야 합니다.',
];

type Step = 'intro' | 'password' | 'complete';

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
  const close = () => router.push('/settings/personal-security');

  const handleSubmit = () => {
    if (password.length === 0 || isPending) return;
    setPasswordError('');
    withdraw(
      { password },
      {
        onSuccess: () => setStep('complete'),
        onError: err => {
          // 비밀번호 불일치(U016)만 인라인 에러로 표시. 그 외는 hook의 onError 스낵바가 처리.
          if (isWithdrawPasswordMismatch(err)) setPasswordError('입력한 비밀번호가 일치하지 않습니다.');
        },
      },
    );
  };

  const handleComplete = () => {
    useAuthStore.getState().logout();
    router.replace('/login');
  };

  return (
    <SettingsOverlay bg="bg-background">
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        {step === 'password' && (
          <button
            onClick={stepBack}
            className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
            aria-label="이전 단계"
          >
            <IconChevronLeft size={20} />
          </button>
        )}
        <h2 className="text-heading-md font-bold text-text-primary">하이브톡 탈퇴</h2>
        {step !== 'complete' && (
          <button
            onClick={close}
            className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
            aria-label="닫기"
          >
            <IconClose size={20} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[400px]">
          {step === 'intro' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-heading-md font-medium text-text-primary">하이브톡을 탈퇴하면</h3>
                <ul className="mt-4 space-y-4">
                  {WITHDRAWAL_NOTICES.map((notice, i) => (
                    <li key={i} className="flex gap-2 text-sub text-text-secondary">
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
                  <Checkbox checked={confirmed} size="md" />
                </span>
                <span className="flex-1 text-sub font-medium text-text-primary">
                  위 유의사항을 모두 확인했어요. 탈퇴를 진행할게요.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStep('password')}
                disabled={!confirmed}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
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
                <input
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
                  className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sub text-text-primary outline-none transition ${passwordError ? 'border-red-400 ring-1 ring-inset ring-red-400' : 'border-divider focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary'}`}
                />
                {passwordError && <p className="mt-1 text-sub-sm text-red-500">{passwordError}</p>}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={password.length === 0 || isPending}
                className="w-full rounded-lg bg-red-500 py-2.5 text-sub font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-disabled"
              >
                {isPending ? '처리 중...' : '인증 및 하이브톡 탈퇴하기'}
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center gap-4 pt-10 text-center">
              <h3 className="text-heading-lg font-semibold text-text-primary">회원 탈퇴가 완료되었어요</h3>
              <p className="text-sub text-text-secondary">
                그동안 하이브톡을 이용해 주셔서 감사합니다.
                <br />더 나은 서비스로 다시 만나뵙기를 바랍니다.
              </p>
              <button
                type="button"
                onClick={handleComplete}
                className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </SettingsOverlay>
  );
}

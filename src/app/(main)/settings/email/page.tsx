'use client';

import { IconChevronLeft, IconClose } from '@/shared/ui/icons';
import { SettingsOverlay } from '../_components/SettingsOverlay';
import { useChangeEmail } from './useChangeEmail';

export default function ChangeEmailPage() {
  const {
    step,
    email,
    code,
    setCode,
    emailError,
    isLoading,
    handleEmailChange,
    handleSendCode,
    handleVerifyAndChange,
    goBack,
    close,
  } = useChangeEmail();

  const canComplete = step === 'CODE' && code.length === 6 && !isLoading;

  return (
    <SettingsOverlay bg="bg-background">
      {/* TopBar — ←(이전 단계/상세) / 중앙 타이틀 / X(전체설정으로) */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        <button
          onClick={goBack}
          className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
          aria-label={step === 'CODE' ? '이전 단계' : '뒤로가기'}
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">이메일</h2>
        <button
          onClick={close}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
          aria-label="닫기"
        >
          <IconClose size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6">
          <h1 className="text-heading-xl font-semibold text-text-primary">이메일 변경</h1>

          <div className="flex flex-col gap-4">
            {/* 이메일 입력 + 인라인 인증요청 */}
            <div>
              <div
                className={`flex h-14 items-center gap-2 rounded-[10px] border bg-surface px-4 ${
                  emailError ? 'border-state-error' : 'border-outline'
                }`}
              >
                <input
                  type="email"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendCode();
                  }}
                  placeholder="변경할 이메일을 입력하세요"
                  autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-body font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
                />
                <button
                  onClick={handleSendCode}
                  disabled={isLoading || email.trim().length === 0}
                  className="shrink-0 rounded-md bg-gray-100 px-3.5 py-2.5 text-sub font-medium text-text-secondary transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  {step === 'EMAIL' ? '인증요청' : '재요청'}
                </button>
              </div>
              {emailError && <p className="mt-1.5 text-sub-sm text-state-error">{emailError}</p>}
            </div>

            {/* 인증번호 입력 (코드 발송 후 노출) */}
            {step === 'CODE' && (
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && canComplete) handleVerifyAndChange();
                  }}
                  placeholder="인증번호 6자리"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  className="h-14 w-full rounded-[10px] border border-outline bg-surface px-4 text-body font-medium tracking-[0.2em] text-text-primary outline-none placeholder:tracking-normal placeholder:font-normal placeholder:text-text-placeholder focus:border-primary"
                />
                <p className="mt-1.5 text-sub-sm text-text-tertiary">
                  <span className="font-medium text-text-secondary">{email}</span> 로 보낸 인증번호 6자리를 입력하세요.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleVerifyAndChange}
            disabled={!canComplete}
            className="h-14 w-full rounded-xl bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
          >
            {isLoading ? '변경 중...' : '완료'}
          </button>
        </div>
      </div>
    </SettingsOverlay>
  );
}

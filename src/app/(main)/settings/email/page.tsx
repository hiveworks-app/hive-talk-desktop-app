'use client';

import { IconChevronLeft } from '@/shared/ui/icons';
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
    currentEmail,
    stepNum,
    handleEmailChange,
    handleSendCode,
    handleVerifyAndChange,
    goBack,
  } = useChangeEmail();

  return (
    <SettingsOverlay bg="bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button
          onClick={goBack}
          className="electron-no-drag text-text-tertiary hover:text-text-secondary"
          aria-label="뒤로가기"
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">이메일 변경</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[400px]">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sub font-medium text-text-primary">
                {step === 'EMAIL' ? '새 이메일' : '코드 확인'}
              </span>
              <span className="text-sub-sm text-text-tertiary">{stepNum} / 2</span>
            </div>
            <div className="h-1 w-full rounded-full bg-gray-200">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{ width: `${(stepNum / 2) * 100}%` }}
              />
            </div>
          </div>

          {step === 'EMAIL' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">
                변경할 새 이메일을 입력하면 해당 주소로 인증 코드를 보냅니다.
              </p>
              <div className="rounded-lg border border-divider bg-surface px-4 py-3">
                <span className="text-sub-sm text-text-tertiary">현재 이메일</span>
                <div className="mt-1 truncate text-sub font-medium text-text-primary">
                  {currentEmail ?? '-'}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sub-sm font-medium text-text-secondary">새 이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendCode();
                  }}
                  placeholder="new@example.com"
                  autoComplete="email"
                  className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sub text-text-primary outline-none focus:border-primary ${emailError ? 'border-red-400' : 'border-divider'}`}
                />
                {emailError && <p className="mt-1 text-sub-sm text-red-500">{emailError}</p>}
              </div>
              <button
                onClick={handleSendCode}
                disabled={isLoading || email.trim().length === 0}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
              >
                {isLoading ? '발송 중...' : '인증 코드 발송'}
              </button>
            </div>
          )}

          {step === 'CODE' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">
                <span className="font-medium text-text-primary">{email}</span> 로 발송된 인증번호 6자리를 입력해 주세요.
              </p>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleVerifyAndChange();
                }}
                placeholder="000000"
                maxLength={6}
                className="w-full rounded-lg border border-divider bg-surface px-4 py-3 text-center text-heading-lg tracking-[0.5em] text-text-primary outline-none focus:border-primary"
              />
              <button
                onClick={handleVerifyAndChange}
                disabled={isLoading || code.length < 6}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
              >
                {isLoading ? '변경 중...' : '이메일 변경'}
              </button>
              <button
                onClick={handleSendCode}
                disabled={isLoading}
                className="w-full text-sub-sm text-text-tertiary hover:underline"
              >
                인증 코드 재발송
              </button>
            </div>
          )}
        </div>
      </div>
    </SettingsOverlay>
  );
}

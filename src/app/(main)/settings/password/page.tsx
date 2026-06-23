'use client';

import { useState } from 'react';
import { IconPasswordVisibilityOff, IconPasswordVisibilityOn } from '@assets/icons';
import { IconChevronLeft, IconClose } from '@/shared/ui/icons';
import { SettingsOverlay } from '../_components/SettingsOverlay';
import { useChangePassword } from './useChangePassword';

export default function ChangePasswordPage() {
  const {
    step,
    userEmail,
    phone,
    code,
    setCode,
    isCodeSent,
    password,
    setPassword,
    passwordConfirm,
    setPasswordConfirm,
    passwordConfirmError,
    canRequestCode,
    canVerify,
    canSubmitReset,
    isLoading,
    timer,
    handlePhoneChange,
    handleSendCode,
    handleVerifyCode,
    handleChangePassword,
    goBack,
    close,
  } = useChangePassword();

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  return (
    <SettingsOverlay bg="bg-background">
      {/* TopBar — ←(이전 단계/상세) / 중앙 타이틀 / X(전체설정으로) */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        <button
          onClick={goBack}
          className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
          aria-label={step === 'RESET' ? '이전 단계' : '뒤로가기'}
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">비밀번호</h2>
        <button
          onClick={close}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
          aria-label="닫기"
        >
          <IconClose size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {step === 'VERIFY' ? (
          /* ── Step 1: 본인인증 (이메일 확인 + 휴대폰 SMS) ── */
          <div className="mx-auto flex max-w-[400px] flex-col gap-6">
            <h1 className="text-heading-xl font-semibold text-text-primary">비밀번호 변경</h1>

            <div className="flex flex-col gap-3">
              {/* 이메일 (읽기 전용) */}
              <div className="flex h-14 items-center rounded-[10px] border border-outline bg-disabled px-4">
                <span className="truncate text-body font-medium text-text-tertiary">
                  {userEmail || '-'}
                </span>
              </div>

              {/* 휴대폰 입력 + 인증요청 */}
              <div className="flex h-14 items-center gap-2 rounded-[10px] border border-outline bg-surface px-4">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="휴대전화(-없이)"
                  maxLength={11}
                  className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                />
                <button
                  onClick={handleSendCode}
                  disabled={!canRequestCode}
                  className="shrink-0 rounded-md bg-gray-100 px-3.5 py-2.5 text-sub font-medium text-text-secondary transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  {isCodeSent ? '재요청' : '인증요청'}
                </button>
              </div>

              {/* 인증번호 입력 (발송 후 노출) */}
              {isCodeSent && (
                <div className="flex h-14 items-center gap-2 rounded-[10px] border border-outline bg-surface px-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canVerify) handleVerifyCode();
                    }}
                    placeholder="인증번호 입력"
                    maxLength={6}
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                  {timer.formattedTime && (
                    <span className="shrink-0 text-sub font-medium text-state-error">
                      {timer.formattedTime}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={!canVerify}
              className="h-14 w-full rounded-xl bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
            >
              {isLoading ? '확인 중...' : '비밀번호 변경'}
            </button>
          </div>
        ) : (
          /* ── Step 2: 새 비밀번호 설정 ── */
          <div className="mx-auto flex max-w-[400px] flex-col gap-6">
            <p className="text-heading-md font-medium text-text-primary">
              안전한 서비스를 이용을 위해
              <br />
              새 비밀번호를 설정해주세요.
            </p>

            <div className="flex flex-col gap-3">
              {/* 새 비밀번호 */}
              <div className="flex h-14 items-center gap-2 rounded-[10px] border border-outline bg-surface px-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label="비밀번호 표시 전환"
                  className="shrink-0 text-text-tertiary"
                >
                  {showPassword ? (
                    <IconPasswordVisibilityOn className="h-5 w-5" />
                  ) : (
                    <IconPasswordVisibilityOff className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* 새 비밀번호 확인 */}
              <div>
                <div className="flex h-14 items-center gap-2 rounded-[10px] border border-outline bg-surface px-4">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canSubmitReset) handleChangePassword();
                    }}
                    placeholder="새 비밀번호 확인"
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(v => !v)}
                    aria-label="비밀번호 표시 전환"
                    className="shrink-0 text-text-tertiary"
                  >
                    {showPasswordConfirm ? (
                      <IconPasswordVisibilityOn className="h-5 w-5" />
                    ) : (
                      <IconPasswordVisibilityOff className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordConfirmError && (
                  <p className="mt-1.5 text-sub-sm text-state-error">{passwordConfirmError}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleChangePassword}
              disabled={!canSubmitReset}
              className="h-14 w-full rounded-xl bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
            >
              {isLoading ? '변경 중...' : '새 비밀번호로 변경'}
            </button>

            <div className="rounded-xl bg-gray-100 px-4 py-2.5">
              <ul className="list-disc pl-5 text-sub text-text-secondary">
                <li>비밀번호는 영문 + 숫자 + 특수문자 3종류 조합, 8자리 이상 입력해주세요.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </SettingsOverlay>
  );
}

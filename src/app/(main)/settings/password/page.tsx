'use client';

import { useState } from 'react';
import { IconArrowBack, IconCloseStroke, IconPasswordVisibilityOff, IconPasswordVisibilityOn } from '@assets/icons';
import { cn } from '@/shared/lib/cn';
import { IconCheck, IconClearCircle } from '@/shared/ui/icons';
import { Spinner } from '@/shared/ui/Spinner';
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
    isCodeDisabled,
    codeErrorMessage,
    password,
    passwordConfirm,
    passwordError,
    confirmError,
    canRequestCode,
    canVerify,
    canSubmitReset,
    isSending,
    isLoading,
    timer,
    handlePhoneChange,
    handlePasswordChange,
    handlePasswordConfirmChange,
    handleSendCode,
    handleVerifyCode,
    handleChangePassword,
    goBack,
    close,
    goToAccountDetail,
  } = useChangePassword();

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  // 클리어(X) 버튼은 포커스된 칸에만 노출 (Figma) — 순수 UI 상태라 페이지에서 관리
  const [focusedField, setFocusedField] = useState<'password' | 'confirm' | null>(null);

  return (
    <SettingsOverlay bg="bg-background">
      {/* TopBar — ←(이전 단계/상세) / 중앙 타이틀 / X. 완료(DONE) 화면은 ← 제거, X→계정정보 */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        {step !== 'DONE' && (
          <button
            onClick={goBack}
            className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
            aria-label={step === 'RESET' ? '이전 단계' : '뒤로가기'}
          >
            <IconArrowBack width={20} height={20} />
          </button>
        )}
        <h2 className="text-heading-md font-medium text-text-primary">비밀번호</h2>
        <button
          onClick={step === 'DONE' ? goToAccountDetail : close}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      {step === 'DONE' ? (
        /* ── 변경 완료 화면 (← 없음, X→계정정보) ── */
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center gap-5">
            <div className="flex size-[50px] items-center justify-center rounded-full bg-blue-100">
              <IconCheck size={24} className="text-primary" />
            </div>
            <p className="text-heading-md font-semibold text-text-primary">비밀번호 변경 완료</p>
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {step === 'VERIFY' ? (
          /* ── Step 1: 본인인증 (이메일 확인 + 휴대폰 SMS) ── */
          <div className="mx-auto flex max-w-[400px] flex-col gap-6">
            <h1 className="text-heading-xl font-semibold text-text-primary">비밀번호 변경</h1>

            <div className="flex flex-col gap-3">
              {/* 이메일 (읽기 전용) */}
              <div className="flex h-10 items-center rounded-[10px] border border-outline bg-disabled px-4">
                <span className="truncate text-body font-medium text-text-tertiary">
                  {userEmail || '-'}
                </span>
              </div>

              {/* 휴대폰 입력 + 인증요청 */}
              <div className="flex h-10 items-center gap-2 rounded-[10px] border border-outline bg-surface px-4">
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
                  className={cn(
                    'flex h-7 min-w-[64px] shrink-0 items-center justify-center rounded-md px-3.5 text-sub font-medium transition-colors',
                    isSending
                      ? 'bg-blue-100 text-blue-500' // 진행중: blue 100 배경 + 스피너
                      : canRequestCode
                        ? 'bg-blue-100 text-blue-500 active:bg-blue-300' // 활성: blue 100 배경 + blue 500 글자, press 시 blue 300
                        : 'bg-gray-100 text-gray-600', // 비활성: gray 100(#F3F5F8) 배경 + gray 600(#6B7684) 글자
                  )}
                >
                  {isSending ? <Spinner /> : isCodeSent ? '재전송' : '인증요청'}
                </button>
              </div>

              {/* 인증번호 입력 (발송 후 노출) — 오답(빨강 2px) / 만료·5회잠금(회색 비활성) 인라인 처리 */}
              {isCodeSent && (
                <div className="flex flex-col gap-2">
                  <div
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-[10px] border px-4 transition',
                      isCodeDisabled
                        ? 'border-outline bg-disabled' // 5회 실패/시간초과: 비활성 회색
                        : codeErrorMessage
                          ? 'border-state-error bg-surface ring-1 ring-inset ring-state-error' // 오답: 빨강 2px
                          : 'border-outline bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary', // 정상
                    )}
                  >
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
                      disabled={isCodeDisabled}
                      autoFocus
                      className={cn(
                        'min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-placeholder',
                        isCodeDisabled ? 'text-text-tertiary' : 'text-text-primary',
                      )}
                    />
                    {timer.formattedTime && (
                      <span
                        className={cn(
                          'shrink-0 text-sub font-medium tabular-nums',
                          isCodeDisabled ? 'text-text-tertiary' : 'text-primary',
                        )}
                      >
                        {timer.formattedTime}
                      </span>
                    )}
                  </div>
                  {codeErrorMessage && (
                    <p className="text-sub font-medium text-state-error">{codeErrorMessage}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={!canVerify}
              className="h-10 w-full rounded-[10px] bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
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
              {/* 새 비밀번호 — 길이/조합 오류 시 빨강 2px + 인라인 메시지 */}
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-[10px] border bg-surface px-4 transition',
                    passwordError
                      ? 'border-state-error ring-1 ring-inset ring-state-error'
                      : 'border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary',
                  )}
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => handlePasswordChange(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="새 비밀번호"
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                  {focusedField === 'password' && password.length > 0 && (
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handlePasswordChange('')}
                      aria-label="입력 지우기"
                      className="shrink-0 text-text-tertiary"
                    >
                      <IconClearCircle className="h-5 w-5" />
                    </button>
                  )}
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
                {passwordError && (
                  <p className="text-sub font-medium text-state-error">{passwordError}</p>
                )}
              </div>

              {/* 새 비밀번호 확인 — 불일치(제출 시 검증) 시 빨강 2px + 인라인 메시지 */}
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-[10px] border bg-surface px-4 transition',
                    confirmError
                      ? 'border-state-error ring-1 ring-inset ring-state-error'
                      : 'border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary',
                  )}
                >
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => handlePasswordConfirmChange(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canSubmitReset) handleChangePassword();
                    }}
                    placeholder="새 비밀번호 확인"
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                  {focusedField === 'confirm' && passwordConfirm.length > 0 && (
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handlePasswordConfirmChange('')}
                      aria-label="입력 지우기"
                      className="shrink-0 text-text-tertiary"
                    >
                      <IconClearCircle className="h-5 w-5" />
                    </button>
                  )}
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
                {confirmError && (
                  <p className="text-sub font-medium text-state-error">{confirmError}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleChangePassword}
              disabled={!canSubmitReset}
              className="h-10 w-full rounded-[10px] bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
            >
              {isLoading ? '변경 중...' : '새 비밀번호로 변경'}
            </button>

            <div className="rounded-xl bg-gray-100 px-4 py-2.5">
              <ul className="list-disc pl-5 text-sub text-gray-700">
                <li>비밀번호는 영문 + 숫자 + 특수문자 3종류 조합, 8자리 이상 입력해주세요.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      )}
    </SettingsOverlay>
  );
}

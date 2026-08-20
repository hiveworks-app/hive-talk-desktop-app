'use client';

import { useEffect } from 'react';
import { useFindPassword } from '@/features/find-password/useFindPassword';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SmsVerificationSection } from './SmsVerificationSection';

interface FindPasswordContentProps {
  initialEmail: string;
  /** reset/complete 단계 진입 시 상단 탭 숨김 (RN showSegment 패리티) */
  onStepChange?: (hideTabs: boolean) => void;
}

export function FindPasswordContent({ initialEmail, onStepChange }: FindPasswordContentProps) {
  const {
    step,
    email,
    phone,
    verificationCode,
    isCodeSent,
    isSending,
    isVerifying,
    isResetting,
    newPassword,
    confirmPassword,
    timer,
    canSendCode,
    canVerify,
    canResetPassword,
    isMaxFailuresReached,
    sendErrorMessage,
    verifyErrorMessage,
    passwordError,
    confirmPasswordError,
    handleEmailChange,
    handlePhoneChange,
    handleVerificationCodeChange,
    setNewPassword,
    setConfirmPassword,
    handleSendCode,
    handleVerifyCode,
    handleResetPassword,
  } = useFindPassword(initialEmail);

  useEffect(() => {
    const t = setTimeout(() => onStepChange?.(step !== 'input'), 0);
    return () => clearTimeout(t);
  }, [step, onStepChange]);

  if (step === 'complete') {
    return (
      <div className="flex flex-1 flex-col px-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <div className="flex size-[50px] items-center justify-center rounded-full bg-blue-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-heading-md font-semibold text-text-primary">비밀번호 변경 완료</p>
            <p className="text-sub text-text-tertiary">새 비밀번호로 로그인해주세요.</p>
          </div>
        </div>
        <div className="pb-4">
          <Button variant="primary" size="lg" fullWidth onClick={() => { window.location.href = '/login'; }}>
            로그인 페이지로 가기
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className="flex flex-1 flex-col px-4">
        <div className="flex-1 space-y-[30px] pt-[30px]">
          <div className="space-y-2">
            <h2 className="text-heading-lg font-semibold text-text-primary">
              새 비밀번호 설정
            </h2>
            <p className="text-sub text-text-tertiary">
              본인인증이 완료되었습니다.
              <br />
              새로운 비밀번호를 입력해주세요.
            </p>
          </div>

          {/* 규칙 위반 시 인라인 에러 + 빨강 보더 (RN getPasswordError 패리티) */}
          <div className="space-y-2">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호"
              error={!!passwordError}
              className="h-10"
            />
            {passwordError && (
              <p className="text-sub-sm text-state-error">{passwordError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              error={!!confirmPasswordError}
              className="h-10"
            />
            {confirmPasswordError && (
              <p className="text-sub-sm text-state-error">{confirmPasswordError}</p>
            )}
          </div>

          {/* 비밀번호 정책 안내 (settings/password 안내 박스와 동일 스타일) */}
          <div className="rounded-xl bg-gray-100 px-4 py-2.5">
            <ul className="list-disc pl-5 text-sub text-gray-700">
              <li>비밀번호는 영문 + 숫자 + 특수문자 3종류 조합, 8자리 이상 입력해주세요.</li>
            </ul>
          </div>
        </div>

        <div className="pb-4">
          {/* 비활성 시 회색(dark variant) — 아이디 찾기 CTA와 동일 규칙 */}
          <Button
            variant={canResetPassword ? 'primary' : 'dark'}
            size="lg"
            fullWidth
            onClick={handleResetPassword}
            disabled={!canResetPassword}
          >
            {isResetting ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-5 pt-[30px]">
        <Input
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="이메일"
          error={!!sendErrorMessage}
          className="h-10"
        />

        <div className="space-y-2">
          <div className="relative">
            <Input
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="휴대전화(-없이)"
              inputMode="numeric"
              maxLength={11}
              error={!!sendErrorMessage}
              className="h-10 pr-24"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={!canSendCode}
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2 h-8 rounded-md px-3 text-sub-sm font-medium transition-colors',
                canSendCode
                  ? 'bg-[#E6F3FF] text-primary'
                  : 'bg-[#ADB5BD] text-white',
              )}
            >
              {isSending ? '발송 중...' : isCodeSent ? '재발송' : '인증요청'}
            </button>
          </div>
          {/* 발송 실패(없는 계정 등) 인라인 에러 — 토스트 대신 필드 하단 표기 (RN 패리티) */}
          {sendErrorMessage && (
            <p className="text-sub-sm text-state-error">{sendErrorMessage}</p>
          )}
        </div>

        {isCodeSent && (
          <SmsVerificationSection
            verificationCode={verificationCode}
            onChangeVerificationCode={handleVerificationCodeChange}
            timerText={timer.formattedTime}
            isExpired={timer.isExpired}
            isVerified={false}
            isVerifying={isVerifying}
            canVerify={canVerify}
            onVerify={handleVerifyCode}
            errorMessage={verifyErrorMessage}
            isMaxFailuresReached={isMaxFailuresReached}
            showVerifyButton={false}
          />
        )}
      </div>

      {/* CTA "비밀번호 변경" — 인증확인 수행 (항상 노출, 발송+입력 완료 시 활성).
          배치는 아이디 찾기와 동일하게 입력 바로 아래 (RN의 하단 고정은 모바일 관례라 미이식) */}
      <div className="pb-4 pt-5">
        {/* 비활성 시 회색(dark variant) — 아이디 찾기 CTA와 동일 규칙 */}
        <Button
          variant={isCodeSent && canVerify ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleVerifyCode}
          disabled={!isCodeSent || !canVerify || isVerifying}
        >
          {isVerifying ? '확인 중...' : '비밀번호 변경'}
        </Button>
      </div>
    </div>
  );
}

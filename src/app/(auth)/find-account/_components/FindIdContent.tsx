'use client';

import { useCallback } from 'react';
import { useFindLoginId } from '@/features/find-login-id/useFindLoginId';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SmsVerificationSection } from './SmsVerificationSection';

interface FindIdContentProps {
  onFoundEmail: (email: string) => void;
}

export function FindIdContent({ onFoundEmail }: FindIdContentProps) {
  const {
    step,
    name,
    phone,
    verificationCode,
    isCodeSent,
    isVerified,
    isSending,
    isVerifying,
    foundEmail,
    timer,
    canSendCode,
    canVerify,
    setName,
    handlePhoneChange,
    setVerificationCode,
    handleSendCode,
    handleVerifyCode,
    handleSubmit,
  } = useFindLoginId();

  const handleGoToFindPassword = useCallback(() => {
    onFoundEmail(foundEmail);
  }, [foundEmail, onFoundEmail]);

  const handleGoToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  if (step === 'result') {
    return (
      <div className="flex flex-1 flex-col px-4">
        <div className="flex-1 space-y-[30px] pt-[30px]">
          <div className="space-y-2">
            <h2 className="text-heading-lg font-semibold text-text-primary">
              아이디 찾기 결과
            </h2>
            <p className="text-sub text-text-tertiary">
              회원님의 아이디를 찾았어요.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-outline p-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-primary"
            >
              <path
                d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 6l-10 7L2 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-heading-md font-semibold text-text-primary">
              {foundEmail}
            </p>
          </div>
        </div>

        <div className="space-y-2 pb-4">
          <Button
            variant="outlined"
            size="lg"
            fullWidth
            onClick={handleGoToFindPassword}
          >
            비밀번호 찾기
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={handleGoToLogin}>
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-5 pt-[30px]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="h-11"
        />

        <div className="relative">
          <Input
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="휴대전화(-없이)"
            inputMode="numeric"
            maxLength={11}
            className="h-11 pr-24"
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

        {isCodeSent && (
          <SmsVerificationSection
            verificationCode={verificationCode}
            onChangeVerificationCode={setVerificationCode}
            timerText={timer.formattedTime}
            isExpired={timer.isExpired}
            isVerified={isVerified}
            isVerifying={isVerifying}
            canVerify={canVerify}
            onVerify={handleVerifyCode}
          />
        )}
      </div>

      <div className="mt-5 pb-4">
        <Button
          variant={isVerified ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={!isVerified}
        >
          아이디 찾기
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect } from 'react';
import { useFindLoginId } from '@/features/find-login-id/useFindLoginId';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SmsVerificationSection } from './SmsVerificationSection';

/** 이메일 마스킹 — 로컬파트 마지막 2자를 **로 치환 (개인정보 보호, RN maskEmail 패리티) */
const maskEmail = (email: string): string => {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length <= 2) return email;
  return local.slice(0, -2) + '**' + domain;
};

interface FindIdContentProps {
  /** result 단계 진입 시 상단 탭 숨김 (RN showSegment 패리티) */
  onStepChange?: (hideTabs: boolean) => void;
  onFoundEmail: (email: string) => void;
}

export function FindIdContent({ onFoundEmail, onStepChange }: FindIdContentProps) {
  const {
    step,
    name,
    phone,
    verificationCode,
    isCodeSent,
    isSending,
    isVerifying,
    foundEmail,
    timer,
    canSendCode,
    canVerify,
    sendErrorMessage,
    verifyErrorMessage,
    isMaxFailuresReached,
    handleNameChange,
    handlePhoneChange,
    setVerificationCode,
    handleSendCode,
    handleVerifyCode,
  } = useFindLoginId();

  useEffect(() => {
    const t = setTimeout(() => onStepChange?.(step === 'result'), 0);
    return () => clearTimeout(t);
  }, [step, onStepChange]);

  // 찾은 이메일을 비밀번호 찾기 탭에 전달 (결과 화면이 단일 버튼이 되며 자동 전달만 유지 — RN 패리티)
  useEffect(() => {
    if (step === 'result' && foundEmail) onFoundEmail(foundEmail);
  }, [step, foundEmail, onFoundEmail]);

  const handleGoToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  if (step === 'result') {
    // RN AccountSuccessView 패리티 — 아이콘·제목, 이메일 박스, 버튼이 한 덩어리로 세로 중앙 정렬
    // (블록 간 gap-12, 아이콘-제목 gap-5). 버튼은 하단 고정이 아니라 콘텐츠를 따라간다.
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full flex-col items-center gap-12">
          <div className="flex flex-col items-center gap-5">
            <img src="/find-user-check.png" alt="" className="h-[50px] w-[50px]" />
            <h2 className="text-heading-md font-semibold text-text-primary">아이디 찾기 완료</h2>
          </div>
          <div className="flex w-full items-center justify-center rounded-xl bg-gray-100 p-4">
            <p className="text-heading-md font-semibold text-text-primary">
              {maskEmail(foundEmail)}
            </p>
          </div>
          <Button variant="primary" size="lg" fullWidth onClick={handleGoToLogin}>
            로그인 페이지로 가기
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
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="이름"
          error={!!sendErrorMessage}
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
            className="pr-24"
          />
          <button
            type="button"
            onClick={handleSendCode}
            disabled={!canSendCode}
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 items-center justify-center rounded-md px-3.5 text-sub font-medium transition-colors',
              canSendCode
                ? 'bg-blue-100 text-primary active:bg-blue-300'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            {isSending ? '발송 중...' : isCodeSent ? '재발송' : '인증요청'}
          </button>
        </div>
        {/* 발송 실패("일치하는 계정 없음" 등) 인라인 에러 — 토스트 대신 필드 하단 표기 (RN 패리티) */}
        {sendErrorMessage && (
          <p className="text-sub-sm text-state-error">{sendErrorMessage}</p>
        )}
        </div>

        {isCodeSent && (
          <SmsVerificationSection
            verificationCode={verificationCode}
            onChangeVerificationCode={setVerificationCode}
            timerText={timer.formattedTime}
            isExpired={timer.isExpired}
            isVerified={false}
            isVerifying={isVerifying}
            canVerify={canVerify}
            onVerify={handleVerifyCode}
            showVerifyButton={false}
            errorMessage={verifyErrorMessage}
            isMaxFailuresReached={isMaxFailuresReached}
          />
        )}
      </div>

      <div className="mt-5 pb-4">
        <Button
          variant={canVerify ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleVerifyCode}
          disabled={!isCodeSent || !canVerify}
        >
          {isVerifying ? '확인 중...' : '아이디 찾기'}
        </Button>
      </div>
    </div>
  );
}

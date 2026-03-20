'use client';

import { useState } from 'react';
import { apiSendSms, apiVerifySms } from '@/features/signup/api';
import { isApiError } from '@/shared/api';
import { parsePhoneParts } from '@/shared/utils/phone';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

export function PhoneStep({
  name,
  onChangeName,
  phone,
  onChangePhone,
  onNext,
}: {
  name: string;
  onChangeName: (v: string) => void;
  phone: string;
  onChangePhone: (v: string) => void;
  onNext: () => void;
}) {
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const timer = useCountdownTimer();

  const canSendCode = name.trim().length > 0 && phone.length === 11 && !isSending;
  const isInputDisabled = failCount >= 5 || (isCodeSent && timer.isExpired);

  const errorMessage = (() => {
    if (failCount >= 5) return `인증을 5회 실패했습니다. 다시 요청해주세요. (5/5)`;
    if (isCodeSent && timer.isExpired) return '인증시간이 초과되었습니다. 다시 요청해주세요.';
    if (failCount > 0 && failCount < 5) return `인증번호가 틀렸습니다. 다시 확인해주세요(${failCount}/5)`;
    return null;
  })();

  const handleSendCode = async () => {
    setIsSending(true);
    setSendError(null);
    try {
      await apiSendSms(parsePhoneParts(phone));
      setIsCodeSent(true);
      setVerificationCode('');
      setFailCount(0);
      timer.start();
    } catch (err) {
      if (isApiError(err) && err.message) {
        setSendError(err.message);
      } else {
        setSendError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const canSubmit =
    isCodeSent && verificationCode.length === 5 && !isInputDisabled && !isVerifying;

  const handleNext = async () => {
    if (!canSubmit) return;

    if (!navigator.onLine) {
      setSendError('오프라인 상태에서는 사용할 수 없습니다.');
      return;
    }

    setIsVerifying(true);
    try {
      await apiVerifySms({ ...parsePhoneParts(phone), code: verificationCode });
      timer.stop();
      onNext();
    } catch {
      setFailCount(prev => prev + 1);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-5">
      {/* 타이틀 */}
      <h2 className="text-heading-xl font-semibold text-text-primary">휴대폰번호 인증</h2>

      <div className="space-y-5 pt-[30px]">
        <Input
          value={name}
          onChange={e => onChangeName(e.target.value)}
          placeholder="이름"
          className="h-11"
        />

        <div className="space-y-2">
          <div className="relative">
            <Input
              value={phone}
              onChange={e => {
                onChangePhone(e.target.value.replace(/\D/g, ''));
                if (sendError) setSendError(null);
              }}
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
          {sendError && (
            <p className="text-sub-sm text-state-error">{sendError}</p>
          )}
        </div>

        {isCodeSent && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="인증번호 5자리"
                inputMode="numeric"
                maxLength={5}
                error={!!errorMessage}
                disabled={isInputDisabled}
                className="h-11 pr-16"
              />
              <span className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-sub-sm font-medium',
                timer.isExpired ? 'text-text-tertiary' : 'text-primary',
              )}>
                {timer.formattedTime}
              </span>
            </div>
            {errorMessage && (
              <p className="text-sub-sm text-state-error">{errorMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 pb-4">
        <Button
          variant={canSubmit ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleNext}
          disabled={!canSubmit}
        >
          {isVerifying ? '확인 중...' : '다음'}
        </Button>
      </div>
    </div>
  );
}

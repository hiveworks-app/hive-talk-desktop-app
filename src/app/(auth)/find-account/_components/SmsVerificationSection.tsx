'use client';

import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

interface SmsVerificationSectionProps {
  verificationCode: string;
  onChangeVerificationCode: (text: string) => void;
  timerText: string;
  isExpired: boolean;
  isVerified: boolean;
  isVerifying: boolean;
  canVerify: boolean;
  onVerify: () => void;
}

export function SmsVerificationSection({
  verificationCode,
  onChangeVerificationCode,
  timerText,
  isExpired,
  isVerified,
  isVerifying,
  canVerify,
  onVerify,
}: SmsVerificationSectionProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={verificationCode}
          onChange={(e) => onChangeVerificationCode(e.target.value)}
          placeholder="인증번호 6자리"
          maxLength={6}
          inputMode="numeric"
          className="h-11 pr-16"
        />
        {timerText && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sub font-semibold text-state-error">
            {timerText}
          </span>
        )}
      </div>
      {isExpired && (
        <p className="text-sub-sm text-state-error">
          인증시간이 만료되었습니다. 재발송 버튼을 눌러주세요.
        </p>
      )}
      {!isVerified && !isExpired && (
        <Button
          variant="primary"
          size="sm"
          onClick={onVerify}
          disabled={!canVerify}
        >
          {isVerifying ? '확인 중...' : '인증확인'}
        </Button>
      )}
      {isVerified && (
        <p className="text-sub-sm text-state-success">인증이 완료되었습니다.</p>
      )}
    </div>
  );
}

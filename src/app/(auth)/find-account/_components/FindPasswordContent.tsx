'use client';

import { useFindPassword } from '@/features/find-password/useFindPassword';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SmsVerificationSection } from './SmsVerificationSection';

interface FindPasswordContentProps {
  initialEmail: string;
}

export function FindPasswordContent({ initialEmail }: FindPasswordContentProps) {
  const {
    step,
    email,
    name,
    phone,
    verificationCode,
    isCodeSent,
    isVerified,
    isSending,
    isVerifying,
    isResetting,
    newPassword,
    confirmPassword,
    timer,
    canSendCode,
    canVerify,
    setEmail,
    setName,
    handlePhoneChange,
    setVerificationCode,
    setNewPassword,
    setConfirmPassword,
    handleSendCode,
    handleVerifyCode,
    handleSubmitVerification,
    handleResetPassword,
  } = useFindPassword(initialEmail);

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

          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            className="h-11"
          />

          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="h-11"
          />
        </div>

        <div className="pb-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleResetPassword}
            disabled={!newPassword || !confirmPassword || isResetting}
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
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="h-11"
        />

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
          onClick={handleSubmitVerification}
          disabled={!isVerified}
        >
          비밀번호 찾기
        </Button>
      </div>
    </div>
  );
}

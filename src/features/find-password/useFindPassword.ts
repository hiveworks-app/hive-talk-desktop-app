import { useCallback, useState } from 'react';
import { isApiError } from '@/shared/api';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isPhonePartsValid, isPhoneValid, parsePhoneParts } from '@/shared/utils/phone';
import { validatePassword } from '@/shared/utils/validation';
import { useFindPasswordReset, useFindPasswordSendSms, useFindPasswordVerify } from './queries';

type FindPasswordStep = 'input' | 'reset' | 'complete';

const MAX_VERIFY_ATTEMPTS = 5;

export const useFindPassword = (initialEmail: string) => {
  const { mutateAsync: sendSms, isPending: isSending } = useFindPasswordSendSms();
  const { mutateAsync: verifySms, isPending: isVerifying } = useFindPasswordVerify();
  const { mutateAsync: resetPassword, isPending: isResetting } = useFindPasswordReset();
  const timer = useCountdownTimer();

  const [step, setStep] = useState<FindPasswordStep>('input');

  // Step 1 상태 — 서버 스펙상 name 필드 제거(RN 패리티): 이메일+전화번호만으로 발송
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  // 인라인 에러 — 발송 실패(없는 계정 등)는 토스트 대신 Input 하단 표기 (RN 패리티)
  const [sendErrorMessage, setSendErrorMessage] = useState('');
  const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
  const [failCount, setFailCount] = useState(0);

  // Step 2 상태
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendCode = useCallback(async () => {
    setSendErrorMessage('');
    if (!email.trim() || !email.includes('@')) {
      setSendErrorMessage('이메일을 정확히 입력해주세요.');
      return;
    }
    const parts = parsePhoneParts(phone);
    if (!isPhonePartsValid(parts)) {
      setSendErrorMessage('전화번호를 정확히 입력해주세요.');
      return;
    }
    try {
      await sendSms({ email: email.trim(), ...parts });
      setIsCodeSent(true);
      setVerificationCode('');
      setVerifyErrorMessage('');
      setFailCount(0);
      timer.start();
    } catch (err) {
      // 없는 계정 등 발송 실패는 토스트 대신 Input 하단 인라인 에러로 노출
      setSendErrorMessage(
        isApiError(err)
          ? err.message || '인증번호 발송에 실패했습니다.'
          : '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
  }, [email, phone, sendSms, timer]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) return;
    const parts = parsePhoneParts(phone);
    setVerifyErrorMessage('');
    try {
      await verifySms({ ...parts, code: verificationCode.trim() });
      // 인증 성공 → 곧바로 새 비밀번호 설정 단계 (RN은 전용 화면 이동, 데스크톱은 인페이지 스텝)
      setStep('reset');
    } catch (err) {
      const nextFailCount = failCount + 1;
      setFailCount(nextFailCount);
      const baseMessage = isApiError(err)
        ? err.message || '인증번호가 올바르지 않습니다.'
        : '요청에 실패했습니다. 잠시 후 다시 시도해주세요.';
      setVerifyErrorMessage(`${baseMessage} (${nextFailCount}/${MAX_VERIFY_ATTEMPTS})`);
    }
  }, [phone, verificationCode, verifySms, failCount]);

  // 새 비밀번호 규칙 인라인 검증 (RN getPasswordError 패리티 — 빈값은 표기하지 않음)
  const passwordError = newPassword ? validatePassword(newPassword) : '';
  const confirmPasswordError =
    confirmPassword.length > 0 && newPassword !== confirmPassword
      ? '입력한 비밀번호가 일치하지 않습니다.'
      : '';

  const handleResetPassword = useCallback(async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) return;
    if (validatePassword(newPassword) || newPassword !== confirmPassword) return;
    const parts = parsePhoneParts(phone);
    try {
      await resetPassword({
        ...parts,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      // 완료 화면 표시 (RN ResetPasswordScreen result 단계 패리티) — 즉시 이동하지 않는다
      setStep('complete');
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [newPassword, confirmPassword, phone, resetPassword]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    setSendErrorMessage('');
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text.replace(/\D/g, ''));
    setSendErrorMessage('');
  }, []);

  const handleVerificationCodeChange = useCallback((text: string) => {
    setVerificationCode(text);
    setVerifyErrorMessage('');
  }, []);

  const canSendCode =
    email.trim().length > 0 && email.includes('@') && isPhoneValid(phone) && !isSending;
  const isMaxFailuresReached = failCount >= MAX_VERIFY_ATTEMPTS;
  // SMS 인증번호는 5자리 (RN 패리티 — 이메일 인증만 6자리)
  const canVerify =
    verificationCode.length === 5 && timer.isRunning && !isVerifying && !isMaxFailuresReached;
  const canResetPassword =
    newPassword.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    !passwordError &&
    !confirmPasswordError &&
    !isResetting;

  return {
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
  } as const;
};

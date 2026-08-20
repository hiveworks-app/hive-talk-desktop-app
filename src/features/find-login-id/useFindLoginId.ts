import { useCallback, useState } from 'react';
import { isApiError } from '@/shared/api';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isPhonePartsValid, isPhoneValid, parsePhoneParts } from '@/shared/utils/phone';
import { useFindLoginIdSendSms, useFindLoginIdVerify } from './queries';

type FindIdStep = 'input' | 'result';

const MAX_VERIFY_ATTEMPTS = 5;

export const useFindLoginId = () => {
  const { mutateAsync: sendSms, isPending: isSending } = useFindLoginIdSendSms();
  const { mutateAsync: verifySms, isPending: isVerifying } = useFindLoginIdVerify();
  const timer = useCountdownTimer();

  const [step, setStep] = useState<FindIdStep>('input');
  const [foundEmail, setFoundEmail] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);

  const [failCount, setFailCount] = useState(0);
  const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
  // 발송 실패("일치하는 계정 없음" 등)는 토스트 대신 Input 하단 인라인 에러 (RN 패리티)
  const [sendErrorMessage, setSendErrorMessage] = useState('');

  const handleSendCode = useCallback(async () => {
    setSendErrorMessage('');
    if (!name.trim()) {
      setSendErrorMessage('이름을 입력해주세요.');
      return;
    }
    const parts = parsePhoneParts(phone);
    if (!isPhonePartsValid(parts)) {
      setSendErrorMessage('전화번호를 정확히 입력해주세요.');
      return;
    }
    try {
      await sendSms({ name: name.trim(), ...parts });
      setIsCodeSent(true);
      setVerificationCode('');
      setVerifyErrorMessage('');
      setFailCount(0);
      timer.start();
    } catch (err) {
      setSendErrorMessage(
        isApiError(err)
          ? err.message || '입력하신 정보와 일치하는 계정이 없습니다.'
          : '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
  }, [name, phone, sendSms, timer]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) return;

    const parts = parsePhoneParts(phone);
    setVerifyErrorMessage('');
    try {
      const result = await verifySms({
        name: name.trim(),
        ...parts,
        code: verificationCode.trim(),
      });
      setFoundEmail(result.payload);
      setStep('result');
    } catch (err) {
      const nextFailCount = failCount + 1;
      setFailCount(nextFailCount);
      if (isApiError(err)) {
        const baseMessage = err.message || '인증번호가 올바르지 않습니다.';
        setVerifyErrorMessage(`${baseMessage} (${nextFailCount}/${MAX_VERIFY_ATTEMPTS})`);
      } else {
        setVerifyErrorMessage(`요청에 실패했습니다. 잠시 후 다시 시도해주세요. (${nextFailCount}/${MAX_VERIFY_ATTEMPTS})`);
      }
    }
  }, [name, phone, verificationCode, verifySms, failCount]);

  const handleNameChange = useCallback((text: string) => {
    setName(text);
    setSendErrorMessage('');
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text.replace(/\D/g, ''));
    setSendErrorMessage('');
  }, []);

  const isMaxFailuresReached = failCount >= MAX_VERIFY_ATTEMPTS;
  const canSendCode = name.trim().length > 0 && isPhoneValid(phone) && !isSending;
  // SMS 인증번호는 5자리 (RN 패리티)
  const canVerify =
    verificationCode.length === 5 &&
    timer.isRunning &&
    !isVerifying &&
    !isMaxFailuresReached;

  return {
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
  } as const;
};

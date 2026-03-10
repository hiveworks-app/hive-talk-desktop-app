import { useCallback, useState } from 'react';
import { isApiError } from '@/shared/api';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isPhonePartsValid, isPhoneValid, parsePhoneParts } from '@/shared/utils/phone';
import { useUIStore } from '@/store';
import { useFindLoginIdSendSms, useFindLoginIdVerify } from './queries';

type FindIdStep = 'input' | 'result';

const MAX_VERIFY_ATTEMPTS = 5;

export const useFindLoginId = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);
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

  const handleSendCode = useCallback(async () => {
    if (!name.trim()) {
      showSnackbar({ message: '이름을 입력해주세요.', state: 'error' });
      return;
    }
    const parts = parsePhoneParts(phone);
    if (!isPhonePartsValid(parts)) {
      showSnackbar({ message: '전화번호를 정확히 입력해주세요.', state: 'error' });
      return;
    }
    try {
      await sendSms({ name: name.trim(), ...parts });
      setIsCodeSent(true);
      setVerificationCode('');
      setVerifyErrorMessage('');
      setFailCount(0);
      timer.start();
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [name, phone, sendSms, showSnackbar, timer]);

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

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text.replace(/\D/g, ''));
  }, []);

  const isMaxFailuresReached = failCount >= MAX_VERIFY_ATTEMPTS;
  const canSendCode = name.trim().length > 0 && isPhoneValid(phone) && !isSending;
  const canVerify =
    verificationCode.length > 0 &&
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
    verifyErrorMessage,
    isMaxFailuresReached,
    setName,
    handlePhoneChange,
    setVerificationCode,
    handleSendCode,
    handleVerifyCode,
  } as const;
};

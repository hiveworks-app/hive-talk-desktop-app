import { useCallback, useState } from 'react';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isPhonePartsValid, isPhoneValid, parsePhoneParts } from '@/shared/utils/phone';
import { useUIStore } from '@/store';
import { useFindLoginIdSendSms, useFindLoginIdVerify } from './queries';

type FindIdStep = 'input' | 'result';

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
  const [isVerified, setIsVerified] = useState(false);

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
      timer.start();
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [name, phone, sendSms, showSnackbar, timer]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      showSnackbar({ message: '인증번호를 입력해주세요.', state: 'error' });
      return;
    }
    const parts = parsePhoneParts(phone);
    try {
      const result = await verifySms({
        name: name.trim(),
        ...parts,
        code: verificationCode.trim(),
      });
      setFoundEmail(result.payload);
      setIsVerified(true);
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [name, phone, verificationCode, verifySms, showSnackbar]);

  const handleSubmit = useCallback(() => {
    setStep('result');
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text.replace(/\D/g, ''));
  }, []);

  const canSendCode = name.trim().length > 0 && isPhoneValid(phone) && !isSending;
  const canVerify = verificationCode.length > 0 && timer.isRunning && !isVerifying;

  return {
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
  } as const;
};

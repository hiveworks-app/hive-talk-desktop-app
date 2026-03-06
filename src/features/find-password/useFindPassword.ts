import { useCallback, useState } from 'react';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isPhonePartsValid, isPhoneValid, parsePhoneParts } from '@/shared/utils/phone';
import { useUIStore } from '@/store';
import { useFindPasswordReset, useFindPasswordSendSms, useFindPasswordVerify } from './queries';

type FindPasswordStep = 'input' | 'reset';

export const useFindPassword = (initialEmail: string) => {
  const showSnackbar = useUIStore(state => state.showSnackbar);
  const { mutateAsync: sendSms, isPending: isSending } = useFindPasswordSendSms();
  const { mutateAsync: verifySms, isPending: isVerifying } = useFindPasswordVerify();
  const { mutateAsync: resetPassword, isPending: isResetting } = useFindPasswordReset();
  const timer = useCountdownTimer();

  const [step, setStep] = useState<FindPasswordStep>('input');

  // Step 1 상태
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Step 2 상태
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendCode = useCallback(async () => {
    if (!email.trim() || !email.includes('@')) {
      showSnackbar({ message: '이메일을 정확히 입력해주세요.', state: 'error' });
      return;
    }
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
      await sendSms({ email: email.trim(), name: name.trim(), ...parts });
      setIsCodeSent(true);
      setVerificationCode('');
      timer.start();
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [email, name, phone, sendSms, showSnackbar, timer]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      showSnackbar({ message: '인증번호를 입력해주세요.', state: 'error' });
      return;
    }
    const parts = parsePhoneParts(phone);
    try {
      await verifySms({ ...parts, code: verificationCode.trim() });
      setIsVerified(true);
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [phone, verificationCode, verifySms, showSnackbar]);

  const handleSubmitVerification = useCallback(() => {
    setStep('reset');
  }, []);

  const handleResetPassword = useCallback(async () => {
    if (!newPassword.trim()) {
      showSnackbar({ message: '새 비밀번호를 입력해주세요.', state: 'error' });
      return;
    }
    if (!confirmPassword.trim()) {
      showSnackbar({ message: '비밀번호 확인을 입력해주세요.', state: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showSnackbar({ message: '비밀번호가 일치하지 않습니다.', state: 'error' });
      return;
    }
    const parts = parsePhoneParts(phone);
    try {
      await resetPassword({
        ...parts,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      window.location.href = '/login';
    } catch {
      // onError 콜백에서 스낵바 처리됨
    }
  }, [newPassword, confirmPassword, phone, resetPassword, showSnackbar]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text.replace(/\D/g, ''));
  }, []);

  const canSendCode =
    email.trim().length > 0 &&
    email.includes('@') &&
    name.trim().length > 0 &&
    isPhoneValid(phone) &&
    !isSending;
  const canVerify = verificationCode.length > 0 && timer.isRunning && !isVerifying;

  return {
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
  } as const;
};

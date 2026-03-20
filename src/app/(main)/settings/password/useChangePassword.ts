'use client';

import { useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { apiEmailVerifications, apiEmailVerificationChecker, apiChangePassword } from '@/features/change-password/api';
import { isApiError } from '@/shared/api';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';

type Step = 'EMAIL' | 'CODE' | 'PASSWORD';

export function useChangePassword() {
  const router = useAppRouter();
  const { showSnackbar } = useUIStore();
  const userEmail = useAuthStore(s => s.user?.email);

  const [step, setStep] = useState<Step>('EMAIL');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    if (isOffline()) return;
    setIsLoading(true);
    try {
      await apiEmailVerifications();
      showSnackbar({ message: '인증 코드가 이메일로 발송되었습니다.', state: 'success' });
      setStep('CODE');
    } catch (err) {
      showSnackbar({ message: isApiError(err) ? err.message : '인증 코드 발송에 실패했습니다.', state: 'error' });
    } finally { setIsLoading(false); }
  };

  const handleVerifyCode = async () => {
    if (isOffline()) return;
    if (code.length < 6) { showSnackbar({ message: '인증번호 6자리를 입력해 주세요.', state: 'error' }); return; }
    setIsLoading(true);
    try {
      await apiEmailVerificationChecker({ code });
      showSnackbar({ message: '인증이 완료되었습니다.', state: 'success' });
      setStep('PASSWORD');
    } catch (err) {
      showSnackbar({ message: isApiError(err) ? err.message : '인증번호가 올바르지 않습니다.', state: 'error' });
    } finally { setIsLoading(false); }
  };

  const handleChangePassword = async () => {
    if (isOffline()) return;
    if (password.length < 8) { showSnackbar({ message: '비밀번호는 8자 이상이어야 합니다.', state: 'error' }); return; }
    if (password !== passwordConfirm) { showSnackbar({ message: '비밀번호가 일치하지 않습니다.', state: 'error' }); return; }
    setIsLoading(true);
    try {
      await apiChangePassword({ password, passwordConfirm });
      showSnackbar({ message: '비밀번호가 변경되었습니다.', state: 'success' });
      router.push('/settings');
    } catch (err) {
      showSnackbar({ message: isApiError(err) ? err.message : '비밀번호 변경에 실패했습니다.', state: 'error' });
    } finally { setIsLoading(false); }
  };

  const goBack = () => router.push('/settings');
  const stepNum = step === 'EMAIL' ? 1 : step === 'CODE' ? 2 : 3;

  return {
    step, code, setCode, password, setPassword, passwordConfirm, setPasswordConfirm,
    isLoading, userEmail, stepNum, goBack,
    handleSendCode, handleVerifyCode, handleChangePassword,
  };
}

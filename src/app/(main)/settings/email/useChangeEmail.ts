'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiChangeEmail,
  apiChangeEmailVerification,
  apiChangeEmailVerify,
} from '@/features/change-email/api';
import { getErrorMessage } from '@/shared/api';
import { CREDENTIAL_INFO_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { isOffline } from '@/shared/utils/offlineGuard';
import { isValidEmail } from '@/shared/utils/validation';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

type Step = 'EMAIL' | 'CODE';

export function useChangeEmail() {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { showSnackbar } = useUIStore();
  const setAuth = useAuthStore(s => s.setAuth);
  const currentEmail = useAuthStore(s => s.user?.email);

  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailChange = (next: string) => {
    setEmail(next);
    if (emailError) setEmailError('');
  };

  const handleSendCode = async () => {
    if (isOffline()) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }
    if (trimmed === currentEmail) {
      setEmailError('현재 사용 중인 이메일입니다.');
      return;
    }
    setIsLoading(true);
    try {
      await apiChangeEmailVerification({ email: trimmed });
      showSnackbar({ message: '인증 코드가 새 이메일로 발송되었습니다.', state: 'success' });
      setStep('CODE');
    } catch (err) {
      showSnackbar({
        message: getErrorMessage(err, '인증 코드 발송에 실패했습니다.'),
        state: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndChange = async () => {
    if (isOffline()) return;
    if (code.length < 6) {
      showSnackbar({ message: '인증번호 6자리를 입력해 주세요.', state: 'error' });
      return;
    }
    const trimmed = email.trim();
    setIsLoading(true);
    try {
      // 검증 → 최종 변경을 순차 호출 (검증 성공 시에만 변경)
      await apiChangeEmailVerify({ email: trimmed, code });
      await apiChangeEmail({ email: trimmed });

      // authStore 이메일 즉시 반영 + credential 인증시점 캐시 무효화
      const user = useAuthStore.getState().user;
      if (user) setAuth({ user: { ...user, email: trimmed } });
      queryClient.invalidateQueries({ queryKey: CREDENTIAL_INFO_KEY });

      showSnackbar({ message: '이메일이 변경되었습니다.', state: 'success' });
      router.push('/settings/account');
    } catch (err) {
      showSnackbar({
        message: getErrorMessage(err, '이메일 변경에 실패했습니다.'),
        state: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ←(이전 단계): 코드입력 → 이메일입력. X(닫기): 계정정보로 나가기. 역할 분리.
  const stepBack = () => {
    setStep('EMAIL');
    setCode('');
  };

  const close = () => router.push('/settings/account');

  const stepNum = step === 'EMAIL' ? 1 : 2;

  return {
    step,
    email,
    code,
    setCode,
    emailError,
    isLoading,
    currentEmail,
    stepNum,
    handleEmailChange,
    handleSendCode,
    handleVerifyAndChange,
    stepBack,
    close,
  };
}

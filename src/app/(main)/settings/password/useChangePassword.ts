'use client';

import { useState } from 'react';
import {
  apiChangePassword,
  apiSendChangePasswordSms,
  apiVerifyChangePasswordSms,
} from '@/features/change-password/api';
import { getErrorMessage } from '@/shared/api';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isOffline } from '@/shared/utils/offlineGuard';
import { isPhoneValid } from '@/shared/utils/phone';
import { validatePassword } from '@/shared/utils/validation';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';

type Step = 'VERIFY' | 'RESET';

/** 휴대폰 입력 최대 자릿수 (숫자만) */
const PHONE_MAX_LENGTH = 11;

/**
 * 비밀번호 변경 컨트롤러 훅 (SMS 본인인증 기반).
 *
 * 흐름:
 *  1) 휴대폰 11자리 입력 → 인증요청 → 인증번호 입력(5분 타이머)
 *  2) "비밀번호 변경" 클릭 → SMS 검증 성공 시 step='RESET'
 *  3) 새 비밀번호 입력 → 검증 통과 시 비밀번호 변경 API 호출
 */
export function useChangePassword() {
  const router = useAppRouter();
  const { showSnackbar } = useUIStore();
  const userEmail = useAuthStore(s => s.user?.email) ?? '';
  const timer = useCountdownTimer();

  const [step, setStep] = useState<Step>('VERIFY');

  // ── Step 1 (본인인증) ────────────────────────────────
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);

  // ── Step 2 (새 비밀번호) ─────────────────────────────
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // ── 파생값 ───────────────────────────────────────────
  const canRequestCode = isPhoneValid(phone) && !isLoading && (!isCodeSent || timer.isExpired);
  const canVerify = isCodeSent && code.length > 0 && timer.isRunning && !isLoading;

  const passwordError = password.length > 0 ? validatePassword(password) : '';
  const passwordConfirmError =
    passwordConfirm.length > 0 && password !== passwordConfirm
      ? '비밀번호가 일치하지 않습니다.'
      : '';
  const canSubmitReset =
    !!password && !!passwordConfirm && !passwordError && !passwordConfirmError && !isLoading;

  // ── 입력 핸들러 ──────────────────────────────────────
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
    setPhone(digits);
    // 휴대폰 수정 시 진행 중이던 인증 흐름 무효화
    if (isCodeSent) {
      setIsCodeSent(false);
      setCode('');
    }
  };

  // ── 액션 핸들러 ──────────────────────────────────────
  const handleSendCode = async () => {
    if (isOffline()) return;
    if (!isPhoneValid(phone)) {
      showSnackbar({ message: '휴대폰 번호 11자리를 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiSendChangePasswordSms({ phoneFull: phone });
      showSnackbar({ message: '인증번호가 발송되었습니다.', state: 'success' });
      setCode('');
      setIsCodeSent(true);
      timer.start();
    } catch (err) {
      showSnackbar({ message: getErrorMessage(err, '인증번호 발송에 실패했습니다.'), state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (isOffline()) return;
    if (!canVerify) return;
    setIsLoading(true);
    try {
      await apiVerifyChangePasswordSms({ phoneFull: phone, code });
      timer.stop();
      setStep('RESET');
    } catch (err) {
      setCode('');
      showSnackbar({ message: getErrorMessage(err, '인증번호가 올바르지 않습니다.'), state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (isOffline()) return;
    if (!canSubmitReset) return;
    setIsLoading(true);
    try {
      await apiChangePassword({ phoneFull: phone, password, passwordConfirm });
      showSnackbar({ message: '비밀번호가 변경되었습니다.', state: 'success' });
      router.push('/settings/account/detail');
    } catch (err) {
      showSnackbar({ message: getErrorMessage(err, '비밀번호 변경에 실패했습니다.'), state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // ←: RESET 단계 → VERIFY 단계로, 그 외엔 계정정보(상세)로. X(닫기): 전체설정으로.
  const goBack = () => {
    if (step === 'RESET') {
      setStep('VERIFY');
      return;
    }
    router.push('/settings/account/detail');
  };

  const close = () => router.push('/settings');

  return {
    step,
    userEmail,
    phone,
    code,
    setCode,
    isCodeSent,
    password,
    setPassword,
    passwordConfirm,
    setPasswordConfirm,
    passwordConfirmError,
    canRequestCode,
    canVerify,
    canSubmitReset,
    isLoading,
    timer,
    handlePhoneChange,
    handleSendCode,
    handleVerifyCode,
    handleChangePassword,
    goBack,
    close,
  };
}

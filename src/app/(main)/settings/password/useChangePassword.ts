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

type Step = 'VERIFY' | 'RESET' | 'DONE';

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
  const [failCount, setFailCount] = useState(0); // 인증코드 검증 실패 횟수 (5회 → 잠금)

  // ── Step 2 (새 비밀번호) ─────────────────────────────
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [confirmError, setConfirmError] = useState(''); // 비밀번호 불일치 (제출 시점 검증)

  const [isSending, setIsSending] = useState(false); // SMS 발송 전용 (인증요청 버튼 스피너)
  const [isLoading, setIsLoading] = useState(false); // 검증/변경 액션 공용

  // ── 파생값 ───────────────────────────────────────────
  // 5회 실패 또는 인증시간 초과 → 코드 입력 잠금(회색)
  const isCodeDisabled = failCount >= 5 || (isCodeSent && timer.isExpired);
  // 인증코드 인라인 에러 (토스트 대신): 5회 잠금 > 시간초과 > 오답 순으로 우선 표시
  const codeErrorMessage =
    failCount >= 5
      ? '인증을 5회 실패했습니다. 다시 요청해주세요. (5/5)'
      : isCodeSent && timer.isExpired
        ? '인증시간이 초과되었습니다. 다시 요청해주세요.'
        : failCount > 0
          ? `인증번호가 틀렸습니다. 다시 확인해주세요(${failCount}/5)`
          : '';

  // 휴대폰만 유효하면 인증요청/재요청 항상 활성(만료·잠금 시 "다시 요청" 가능) — 이메일/회원가입과 동일
  const canRequestCode = isPhoneValid(phone) && !isLoading && !isSending;
  const canVerify =
    isCodeSent && code.length > 0 && timer.isRunning && !isCodeDisabled && !isLoading && !isSending;

  // 새 비밀번호 자체 유효성(길이/조합)은 입력 즉시 검증 — 빨강 테두리 + 인라인 메시지
  const passwordError = password.length > 0 ? validatePassword(password) : '';
  // 버튼 활성은 "새 비밀번호 유효 + 확인칸 입력"만 요구 (불일치는 제출 시점에 검증) — Figma 기준
  const canSubmitReset = !!password && !passwordError && !!passwordConfirm && !isLoading;

  // 새 비밀번호 / 확인칸 수정 시 불일치 에러는 무효화 (이전 제출 결과가 stale)
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (confirmError) setConfirmError('');
  };
  const handlePasswordConfirmChange = (value: string) => {
    setPasswordConfirm(value);
    if (confirmError) setConfirmError('');
  };

  // ── 입력 핸들러 ──────────────────────────────────────
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
    setPhone(digits);
    // 휴대폰 수정 시 진행 중이던 인증 흐름 무효화
    if (isCodeSent) {
      setIsCodeSent(false);
      setCode('');
      setFailCount(0);
    }
  };

  // ── 액션 핸들러 ──────────────────────────────────────
  const handleSendCode = async () => {
    if (isOffline()) return;
    if (!isPhoneValid(phone)) {
      showSnackbar({ message: '휴대폰 번호 11자리를 입력해 주세요.', state: 'error' });
      return;
    }
    setIsSending(true);
    try {
      await apiSendChangePasswordSms({ phoneFull: phone });
      // 발송 성공은 코드 입력칸 노출 + 타이머 시작이 대신하므로 토스트 미표시
      setCode('');
      setIsCodeSent(true);
      setFailCount(0); // 재요청 시 실패 횟수/잠금 초기화
      timer.start();
    } catch (err) {
      // 발송 실패(레이트리밋 등 비정형 오류)는 인라인 슬롯이 없어 폴백 스낵바 유지
      showSnackbar({ message: getErrorMessage(err, '인증번호 발송에 실패했습니다.'), state: 'error' });
    } finally {
      setIsSending(false);
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
    } catch {
      // 검증 실패 → 토스트 없이 인라인 에러로만 표시. 5회 도달 시 입력 잠금 (회원가입 SMS와 동일)
      setFailCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (isOffline()) return;
    if (!canSubmitReset) return;
    // 일치 검증은 제출 시점에 (불일치면 확인칸 빨강 에러 → API 미호출)
    if (password !== passwordConfirm) {
      setConfirmError('입력한 비밀번호가 일치하지 않습니다.');
      return;
    }
    setConfirmError('');
    setIsLoading(true);
    try {
      await apiChangePassword({ phoneFull: phone, password, passwordConfirm });
      setStep('DONE'); // 변경 완료 화면으로 전환 (토스트 미표시, X→계정정보)
    } catch (err) {
      // 변경 실패(세션 만료 등 비정형 오류)는 인라인 슬롯이 없어 폴백 스낵바 유지
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

  // 완료(DONE) 화면의 X → 계정정보(상세)로 이동
  const goToAccountDetail = () => router.push('/settings/account/detail');

  return {
    step,
    userEmail,
    phone,
    code,
    setCode,
    isCodeSent,
    isCodeDisabled,
    codeErrorMessage,
    password,
    passwordConfirm,
    passwordError,
    confirmError,
    canRequestCode,
    canVerify,
    canSubmitReset,
    isSending,
    isLoading,
    timer,
    handlePhoneChange,
    handlePasswordChange,
    handlePasswordConfirmChange,
    handleSendCode,
    handleVerifyCode,
    handleChangePassword,
    goBack,
    close,
    goToAccountDetail,
  };
}

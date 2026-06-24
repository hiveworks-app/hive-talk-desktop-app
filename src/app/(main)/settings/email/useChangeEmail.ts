'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiChangeEmail,
  apiChangeEmailVerification,
  apiChangeEmailVerify,
} from '@/features/change-email/api';
import { getErrorMessage, isApiError } from '@/shared/api';
import { CREDENTIAL_INFO_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { isOffline } from '@/shared/utils/offlineGuard';
import { isValidEmail } from '@/shared/utils/validation';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

type Step = 'EMAIL' | 'CODE' | 'DONE';

/** CP011 에러 응답({ ..., payload: "N/5" })에서 "N/5" 시도 정보를 안전하게 추출 */
function extractAttempts(payload: unknown): string | null {
  const value =
    payload !== null && typeof payload === 'object' && 'payload' in payload
      ? payload.payload
      : payload;
  return typeof value === 'string' && value.includes('/') ? value : null;
}

export function useChangeEmail() {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { showSnackbar } = useUIStore();
  const setAuth = useAuthStore(s => s.setAuth);
  const currentEmail = useAuthStore(s => s.user?.email);
  const timer = useCountdownTimer(); // 인증번호 유효시간 5분 카운트다운

  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState(''); // 인증번호 오답/잠금 인라인 에러
  const [codeLocked, setCodeLocked] = useState(false); // 5회 실패 → 코드 입력 잠금
  const [isSending, setIsSending] = useState(false); // 인증요청(코드 발송) 진행중
  const [isVerifying, setIsVerifying] = useState(false); // 완료(검증→변경) 진행중

  const handleEmailChange = (next: string) => {
    setEmail(next);
    if (emailError) setEmailError('');
  };

  const handleCodeChange = (next: string) => {
    setCode(next.replace(/\D/g, '').slice(0, 6));
    if (codeError) setCodeError(''); // 코드 수정 시 오답 에러 해제
  };

  const handleSendCode = async () => {
    if (isOffline()) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (trimmed === currentEmail) {
      setEmailError('현재 사용 중인 이메일입니다.');
      return;
    }
    setIsSending(true);
    try {
      await apiChangeEmailVerification({ email: trimmed });
      // 발송 성공 안내는 코드 입력칸 위 파란 멘트가 대신하므로 토스트 미표시
      setStep('CODE');
      setCode(''); // 재요청 시 기존 입력 초기화
      setCodeError('');
      setCodeLocked(false); // 재요청 시 잠금 해제
      timer.start(); // 5분 타이머 시작/재시작
    } catch (err) {
      // 이미 등록된 이메일(IDT003)은 스낵바 대신 인라인 에러로 표시 (디자인)
      if (isApiError(err) && err.code === 'IDT003') {
        setEmailError('이미 사용중인 이메일입니다.');
        return;
      }
      showSnackbar({
        message: getErrorMessage(err, '인증 코드 발송에 실패했습니다.'),
        state: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyAndChange = async () => {
    if (isOffline()) return;
    if (code.length < 6) {
      showSnackbar({ message: '인증번호 6자리를 입력해 주세요.', state: 'error' });
      return;
    }
    const trimmed = email.trim();
    setIsVerifying(true);
    try {
      // 검증 → 최종 변경을 순차 호출 (검증 성공 시에만 변경)
      await apiChangeEmailVerify({ email: trimmed, code });
      await apiChangeEmail({ email: trimmed });

      // authStore 이메일 즉시 반영 + credential 인증시점 캐시 무효화
      const user = useAuthStore.getState().user;
      if (user) setAuth({ user: { ...user, email: trimmed } });
      queryClient.invalidateQueries({ queryKey: CREDENTIAL_INFO_KEY });

      timer.stop();
      setStep('DONE'); // 변경 완료 화면으로 전환 (X 클릭 시 계정정보로 이동)
    } catch (err) {
      // 인증번호 오류(CP011): payload "N/5"로 시도 횟수 분기 (스낵바 대신 인라인 에러)
      if (isApiError(err) && err.code === 'CP011') {
        const attempts = extractAttempts(err.payload); // "N/5"
        const [used, max] = attempts?.split('/') ?? [];
        if (used && max && used === max) {
          // 5회 모두 실패 → 입력 잠금, 재요청 유도
          setCodeError(`인증을 ${max}회 실패했습니다. 다시 요청해주세요. (${attempts})`);
          setCodeLocked(true);
        } else {
          setCodeError(
            attempts
              ? `인증번호가 틀렸습니다. 다시 확인해주세요(${attempts})`
              : '인증번호가 틀렸습니다. 다시 확인해주세요.',
          );
        }
        return;
      }
      showSnackbar({
        message: getErrorMessage(err, '이메일 변경에 실패했습니다.'),
        state: 'error',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // ←: 코드입력 단계 → 이메일입력 단계로, 그 외엔 계정정보(상세)로. X(닫기): 전체설정으로.
  const goBack = () => {
    if (step === 'CODE') {
      setStep('EMAIL');
      setCode('');
      setCodeError('');
      setCodeLocked(false);
      timer.stop();
      return;
    }
    router.push('/settings/account/detail');
  };

  const close = () => router.push('/settings');

  // 변경 완료(DONE) 화면의 X → 계정정보(상세)로 이동
  const goToAccountDetail = () => router.push('/settings/account/detail');

  const stepNum = step === 'EMAIL' ? 1 : 2;

  return {
    step,
    email,
    code,
    emailError,
    codeError,
    codeLocked,
    isSending,
    isVerifying,
    timer,
    currentEmail,
    stepNum,
    handleEmailChange,
    handleCodeChange,
    handleSendCode,
    handleVerifyAndChange,
    goBack,
    close,
    goToAccountDetail,
  };
}

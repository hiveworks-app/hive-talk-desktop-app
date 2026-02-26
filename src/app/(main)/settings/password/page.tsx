'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiEmailVerifications,
  apiEmailVerificationChecker,
  apiChangePassword,
} from '@/features/change-password/api';
import { isApiError } from '@/shared/api';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';

type Step = 'EMAIL' | 'CODE' | 'PASSWORD';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { showSnackbar } = useUIStore();
  const userEmail = useAuthStore(s => s.user?.email);

  const [step, setStep] = useState<Step>('EMAIL');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: 이메일 인증 코드 발송
  const handleSendCode = async () => {
    setIsLoading(true);
    try {
      await apiEmailVerifications();
      showSnackbar({ message: '인증 코드가 이메일로 발송되었습니다.', state: 'success' });
      setStep('CODE');
    } catch (err) {
      const msg = isApiError(err) ? err.message : '인증 코드 발송에 실패했습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 인증 코드 확인
  const handleVerifyCode = async () => {
    if (code.length < 6) {
      showSnackbar({ message: '인증번호 6자리를 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiEmailVerificationChecker({ code });
      showSnackbar({ message: '인증이 완료되었습니다.', state: 'success' });
      setStep('PASSWORD');
    } catch (err) {
      const msg = isApiError(err) ? err.message : '인증번호가 올바르지 않습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: 비밀번호 변경
  const handleChangePassword = async () => {
    if (password.length < 8) {
      showSnackbar({ message: '비밀번호는 8자 이상이어야 합니다.', state: 'error' });
      return;
    }
    if (password !== passwordConfirm) {
      showSnackbar({ message: '비밀번호가 일치하지 않습니다.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiChangePassword({ password, passwordConfirm });
      showSnackbar({ message: '비밀번호가 변경되었습니다.', state: 'success' });
      router.push('/settings');
    } catch (err) {
      const msg = isApiError(err) ? err.message : '비밀번호 변경에 실패했습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const stepNum = step === 'EMAIL' ? 1 : step === 'CODE' ? 2 : 3;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button
          onClick={() => router.push('/settings')}
          className="text-text-tertiary hover:text-text-secondary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">비밀번호 변경</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[400px]">
          {/* 진행 바 */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sub font-medium text-text-primary">
                {step === 'EMAIL' ? '이메일 인증' : step === 'CODE' ? '코드 확인' : '새 비밀번호'}
              </span>
              <span className="text-sub-sm text-text-tertiary">{stepNum} / 3</span>
            </div>
            <div className="h-1 w-full rounded-full bg-gray-200">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{ width: `${(stepNum / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Step 1: 이메일 인증 */}
          {step === 'EMAIL' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">
                등록된 이메일로 인증 코드를 발송합니다.
              </p>
              <div className="rounded-lg border border-divider bg-surface px-4 py-3">
                <span className="text-sub-sm text-text-tertiary">등록 이메일</span>
                <div className="mt-1 text-sub font-medium text-text-primary">
                  {userEmail ?? '-'}
                </div>
              </div>
              <button
                onClick={handleSendCode}
                disabled={isLoading}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
              >
                {isLoading ? '발송 중...' : '인증 코드 발송'}
              </button>
            </div>
          )}

          {/* Step 2: 코드 확인 */}
          {step === 'CODE' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">
                이메일로 발송된 인증번호 6자리를 입력해 주세요.
              </p>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                maxLength={6}
                className="w-full rounded-lg border border-divider bg-surface px-4 py-3 text-center text-heading-lg tracking-[0.5em] text-text-primary outline-none focus:border-primary"
              />
              <button
                onClick={handleVerifyCode}
                disabled={isLoading || code.length < 6}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
              >
                {isLoading ? '확인 중...' : '확인'}
              </button>
              <button
                onClick={handleSendCode}
                disabled={isLoading}
                className="w-full text-sub-sm text-text-tertiary hover:underline"
              >
                인증 코드 재발송
              </button>
            </div>
          )}

          {/* Step 3: 새 비밀번호 */}
          {step === 'PASSWORD' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">
                새 비밀번호를 입력해 주세요. (8자 이상, 영문+숫자+특수문자)
              </p>
              <div>
                <label className="mb-1 block text-sub-sm font-medium text-text-secondary">새 비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-surface px-3 py-2.5 text-sub text-text-primary outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sub-sm font-medium text-text-secondary">비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-surface px-3 py-2.5 text-sub text-text-primary outline-none focus:border-primary"
                />
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="mt-1 text-sub-sm text-red-500">비밀번호가 일치하지 않습니다</p>
                )}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={isLoading || password.length < 8 || password !== passwordConfirm}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled"
              >
                {isLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

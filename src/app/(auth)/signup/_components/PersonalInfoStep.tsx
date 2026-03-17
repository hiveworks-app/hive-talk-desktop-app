'use client';

import { useState } from 'react';
import { apiCheckEmail } from '@/features/signup/api';
import { isApiError } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { IconClearCircle } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/Input';
import { PasswordField } from '@/shared/ui/PasswordField';

export function PersonalInfoStep({
  email, onChangeEmail,
  password, onChangePassword,
  passwordConfirm, onChangePasswordConfirm,
  onNext,
}: {
  email: string;
  onChangeEmail: (v: string) => void;
  password: string;
  onChangePassword: (v: string) => void;
  passwordConfirm: string;
  onChangePasswordConfirm: (v: string) => void;
  onNext: () => void;
}) {
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getPasswordError = (pw: string) => {
    if (!pw) return '';
    if (pw.includes(' ')) return '비밀번호에 공백을 포함할 수 없습니다';
    if (pw.length < 8) return '8자리 이상 입력해 주세요';
    const hasLetter = /[a-zA-Z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    if ([hasLetter, hasNumber, hasSpecial].filter(Boolean).length < 3) {
      return '영문,숫자,특수문자 3종류를 조합해 주세요';
    }
    return '';
  };

  const handlePasswordChange = (v: string) => {
    onChangePassword(v);
    setPasswordError(getPasswordError(v));
    if (passwordConfirm && v !== passwordConfirm) setConfirmError('비밀번호가 일치하지 않습니다');
    else setConfirmError('');
  };

  const handleConfirmChange = (v: string) => {
    onChangePasswordConfirm(v);
    if (v && password !== v) setConfirmError('비밀번호가 일치하지 않습니다');
    else setConfirmError('');
  };

  const handleEmailChange = (v: string) => {
    onChangeEmail(v);
    setEmailError('');
  };

  const handleEmailBlur = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsCheckingEmail(true);
    try {
      await apiCheckEmail(trimmed);
    } catch (err) {
      setEmailError(isApiError(err) ? err.message || '이미 사용 중인 이메일입니다.' : '이메일 확인에 실패했습니다.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleNext = async () => {
    if (!canSubmit) return;
    setIsCheckingEmail(true);
    try {
      await apiCheckEmail(email.trim());
    } catch (err) {
      setEmailError(isApiError(err) ? err.message || '이미 사용 중인 이메일입니다.' : '이메일 확인에 실패했습니다.');
      setIsCheckingEmail(false);
      return;
    }
    setIsCheckingEmail(false);
    onNext();
  };

  const canSubmit = isValidEmail && !getPasswordError(password) && password === passwordConfirm && !isCheckingEmail;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-6">
        <h2 className="pt-5 text-heading-lg font-semibold text-text-primary">정보 입력</h2>

        <div className="space-y-3">
          {/* 이메일 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => { setEmailFocused(false); handleEmailBlur(); }}
                placeholder="이메일"
                error={!!emailError}
                className={cn('h-11', emailFocused && email.length > 0 && 'pr-10')}
              />
              {emailFocused && email.length > 0 && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={preventBlur}
                  onClick={() => handleEmailChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <IconClearCircle />
                </button>
              )}
            </div>
            {emailError && <p className="text-sub-sm text-state-error">{emailError}</p>}
          </div>

          {/* 비밀번호 */}
          <PasswordField
            value={password}
            onChange={handlePasswordChange}
            placeholder="비밀번호"
            error={passwordError}
          />

          {/* 비밀번호 확인 */}
          <PasswordField
            value={passwordConfirm}
            onChange={handleConfirmChange}
            placeholder="비밀번호 확인"
            error={confirmError}
          />
        </div>

        <Button variant={canSubmit ? 'primary' : 'dark'} size="lg" fullWidth onClick={handleNext} disabled={!canSubmit}>
          {isCheckingEmail ? '확인 중...' : '다음'}
        </Button>

        <div className="rounded-xl bg-[#F3F5F8] px-3 py-2.5">
          <p className="text-sub text-[#4E5968]">
            {'  \u2022  비밀번호는 영문 + 숫자 + 특수문자 3종류 조합, 8자리 이상 입력해주세요.'}
          </p>
        </div>
      </div>
    </div>
  );
}

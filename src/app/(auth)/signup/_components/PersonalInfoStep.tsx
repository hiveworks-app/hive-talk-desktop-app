'use client';

import { useState } from 'react';
import { apiCheckEmail } from '@/features/signup/api';
import { isApiError } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

function ClearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
  );
}

export function PersonalInfoStep({
  email,
  onChangeEmail,
  password,
  onChangePassword,
  passwordConfirm,
  onChangePasswordConfirm,
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

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
    if (passwordConfirm && v !== passwordConfirm) {
      setConfirmError('비밀번호가 일치하지 않습니다');
    } else {
      setConfirmError('');
    }
  };

  const handleConfirmChange = (v: string) => {
    onChangePasswordConfirm(v);
    if (v && password !== v) {
      setConfirmError('비밀번호가 일치하지 않습니다');
    } else {
      setConfirmError('');
    }
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
      const message = isApiError(err)
        ? err.message || '이미 사용 중인 이메일입니다.'
        : '이메일 확인에 실패했습니다.';
      setEmailError(message);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleNext = async () => {
    if (!canSubmit) return;

    const trimmedEmail = email.trim();

    setIsCheckingEmail(true);
    try {
      await apiCheckEmail(trimmedEmail);
    } catch (err) {
      const message = isApiError(err)
        ? err.message || '이미 사용 중인 이메일입니다.'
        : '이메일 확인에 실패했습니다.';
      setEmailError(message);
      setIsCheckingEmail(false);
      return;
    }
    setIsCheckingEmail(false);

    onNext();
  };

  const canSubmit =
    isValidEmail &&
    !getPasswordError(password) &&
    password === passwordConfirm &&
    !isCheckingEmail;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-6">
        {/* 타이틀 */}
        <h2 className="pt-5 text-heading-lg font-semibold text-text-primary">정보 입력</h2>

        {/* 입력 필드 */}
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
                  <ClearIcon />
                </button>
              )}
            </div>
            {emailError && <p className="text-sub-sm text-state-error">{emailError}</p>}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="비밀번호"
                error={!!passwordError}
                className={cn(
                  'h-11',
                  password.length > 0 && (passwordFocused ? 'pr-16' : 'pr-10'),
                )}
              />
              {password.length > 0 && (
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {passwordFocused && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={preventBlur}
                      onClick={() => { onChangePassword(''); setPasswordError(''); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ClearIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={preventBlur}
                    onClick={() => setShowPassword(prev => !prev)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              )}
            </div>
            {passwordError && <p className="text-sub-sm text-state-error">{passwordError}</p>}
          </div>

          {/* 비밀번호 확인 */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPasswordConfirm ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={e => handleConfirmChange(e.target.value)}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="비밀번호 확인"
                error={!!confirmError}
                className={cn(
                  'h-11',
                  passwordConfirm.length > 0 && (confirmFocused ? 'pr-16' : 'pr-10'),
                )}
              />
              {passwordConfirm.length > 0 && (
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {confirmFocused && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={preventBlur}
                      onClick={() => { onChangePasswordConfirm(''); setConfirmError(''); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ClearIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={preventBlur}
                    onClick={() => setShowPasswordConfirm(prev => !prev)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon open={showPasswordConfirm} />
                  </button>
                </div>
              )}
            </div>
            {confirmError && <p className="text-sub-sm text-state-error">{confirmError}</p>}
          </div>
        </div>

        {/* 다음 버튼 */}
        <Button
          variant={canSubmit ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleNext}
          disabled={!canSubmit}
        >
          {isCheckingEmail ? '확인 중...' : '다음'}
        </Button>

        {/* 비밀번호 규칙 안내 박스 */}
        <div className="rounded-xl bg-[#F3F5F8] px-3 py-2.5">
          <p className="text-sub text-[#4E5968]">
            {'  \u2022  비밀번호는 영문 + 숫자 + 특수문자 3종류 조합, 8자리 이상 입력해주세요.'}
          </p>
        </div>
      </div>
    </div>
  );
}

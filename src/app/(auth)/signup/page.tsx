'use client';

import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import {
  apiGetSignupTerms,
  apiCheckEmail,
  apiSignup,
  apiSendSms,
  apiVerifySms,
} from '@/features/signup/api';
import type { SignupTerm, SignupTermItem } from '@/features/signup/type';
import { isApiError } from '@/shared/api';
import { parsePhoneParts } from '@/shared/utils/phone';
import { useCountdownTimer } from '@/shared/hooks/useCountdownTimer';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useUIStore } from '@/store';

/* ─── 타입 ─── */
type Step = 'TERMS' | 'PHONE' | 'PERSONAL' | 'COMPANY' | 'COMPLETE';

const STEP_PROGRESS: Record<Exclude<Step, 'COMPLETE'>, number> = {
  TERMS: 1,
  PHONE: 2,
  PERSONAL: 3,
  COMPANY: 4,
};

const STEP_TITLE: Record<Exclude<Step, 'COMPLETE'>, string> = {
  TERMS: '회원가입',
  PHONE: '회원가입',
  PERSONAL: '회원가입',
  COMPANY: '회원가입',
};

const TOTAL_STEPS = 4;

/* ─── Progress Bar ─── */
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-gray-200">
      <div
        className="h-1 rounded-full bg-primary transition-all duration-300"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  );
}

/* ─── Checkbox ─── */
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-gray-300',
      )}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

/* ─── Back Button ─── */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-text-primary hover:text-text-secondary">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

/* ─── Step 1: 약관동의 ─── */
function TermsStep({
  terms,
  agreedTermIds,
  onToggle,
  onToggleAll,
  onNext,
}: {
  terms: SignupTerm[];
  agreedTermIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onNext: () => void;
}) {
  const requiredTerms = terms.filter(t => t.isRequired);
  const allRequiredAgreed = requiredTerms.every(t => agreedTermIds.has(t.id));
  const [detailTerm, setDetailTerm] = useState<SignupTerm | null>(null);

  const canViewDetail = (term: SignupTerm) =>
    !!term.description && !term.title.includes('만 14세');

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-5">
      {/* 타이틀 */}
      <h2 className="mb-6 text-heading-xl font-semibold text-text-primary">약관동의</h2>

      {/* 전체 동의 */}
      <button
        onClick={onToggleAll}
        className="flex h-[50px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Checkbox checked={agreedTermIds.size === terms.length} />
        <span className="text-heading-sm font-semibold text-text-primary">약관 전체 동의하기 (선택 동의 포함)</span>
      </button>

      {/* 개별 약관 */}
      <div className="space-y-1">
        {terms.map(term => (
          <div key={term.id} className="flex items-center rounded-lg py-2.5 hover:bg-surface-pressed">
            <button
              onClick={() => onToggle(term.id)}
              className="flex flex-1 items-center gap-2.5 px-4 text-left"
            >
              <Checkbox checked={agreedTermIds.has(term.id)} />
              <span className="flex-1 text-sub text-text-primary">
                {term.title} {term.isRequired ? '(필수)' : '(선택)'}
              </span>
            </button>
            {canViewDetail(term) && (
              <button
                onClick={() => setDetailTerm(term)}
                className="pr-3 pl-1 text-text-tertiary"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 다음 버튼 */}
      <div className="pt-6 pb-4">
        <Button
          variant={allRequiredAgreed ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={onNext}
          disabled={!allRequiredAgreed}
        >
          다음
        </Button>
      </div>

      {/* 약관 상세 다이얼로그 */}
      {detailTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex max-h-[80vh] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <h3 className="text-heading-sm font-semibold text-text-primary">{detailTerm.title}</h3>
              <button onClick={() => setDetailTerm(null)} className="text-text-tertiary hover:text-text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap text-sub text-text-secondary">{detailTerm.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 2: 휴대폰 인증 ─── */
function PhoneStep({
  name,
  onChangeName,
  phone,
  onChangePhone,
  onNext,
}: {
  name: string;
  onChangeName: (v: string) => void;
  phone: string;
  onChangePhone: (v: string) => void;
  onNext: () => void;
}) {
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const timer = useCountdownTimer();

  const canSendCode = name.trim().length > 0 && phone.length === 11 && !isSending;
  const isInputDisabled = failCount >= 5 || (isCodeSent && timer.isExpired);

  const errorMessage = (() => {
    if (failCount >= 5) return `인증을 5회 실패했습니다. 다시 요청해주세요. (5/5)`;
    if (isCodeSent && timer.isExpired) return '인증시간이 초과되었습니다. 다시 요청해주세요.';
    if (failCount > 0 && failCount < 5) return `인증번호가 틀렸습니다. 다시 확인해주세요(${failCount}/5)`;
    return null;
  })();

  const handleSendCode = async () => {
    setIsSending(true);
    setSendError(null);
    try {
      await apiSendSms(parsePhoneParts(phone));
      setIsCodeSent(true);
      setVerificationCode('');
      setFailCount(0);
      timer.start();
    } catch (err) {
      if (isApiError(err) && err.message) {
        setSendError(err.message);
      } else {
        setSendError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const canSubmit =
    isCodeSent && verificationCode.length === 5 && !isInputDisabled && !isVerifying;

  const handleNext = async () => {
    if (!canSubmit) return;

    setIsVerifying(true);
    try {
      await apiVerifySms({ ...parsePhoneParts(phone), code: verificationCode });
      timer.stop();
      onNext();
    } catch {
      setFailCount(prev => prev + 1);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-5">
      {/* 타이틀 */}
      <h2 className="text-heading-xl font-semibold text-text-primary">휴대폰번호 인증</h2>

      <div className="space-y-5 pt-[30px]">
        <Input
          value={name}
          onChange={e => onChangeName(e.target.value)}
          placeholder="이름"
          className="h-11"
        />

        <div className="space-y-2">
          <div className="relative">
            <Input
              value={phone}
              onChange={e => {
                onChangePhone(e.target.value.replace(/\D/g, ''));
                if (sendError) setSendError(null);
              }}
              placeholder="휴대전화(-없이)"
              inputMode="numeric"
              maxLength={11}
              className="h-11 pr-24"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={!canSendCode}
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2 h-8 rounded-md px-3 text-sub-sm font-medium transition-colors',
                canSendCode
                  ? 'bg-[#E6F3FF] text-primary'
                  : 'bg-[#ADB5BD] text-white',
              )}
            >
              {isSending ? '발송 중...' : isCodeSent ? '재발송' : '인증요청'}
            </button>
          </div>
          {sendError && (
            <p className="text-sub-sm text-state-error">{sendError}</p>
          )}
        </div>

        {isCodeSent && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="인증번호 5자리"
                inputMode="numeric"
                maxLength={5}
                error={!!errorMessage}
                disabled={isInputDisabled}
                className="h-11 pr-16"
              />
              <span className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-sub-sm font-medium',
                timer.isExpired ? 'text-text-tertiary' : 'text-primary',
              )}>
                {timer.formattedTime}
              </span>
            </div>
            {errorMessage && (
              <p className="text-sub-sm text-state-error">{errorMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 pb-4">
        <Button
          variant={canSubmit ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={handleNext}
          disabled={!canSubmit}
        >
          {isVerifying ? '확인 중...' : '다음'}
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: 개인정보 입력 ─── */
function PersonalInfoStep({
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

    // 이메일 형식이 유효하면 중복 확인
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

    // 이메일 중복 체크
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

/* ─── Step 4: 회사정보 입력 ─── */
function CompanyStep({
  companyName,
  onChangeCompanyName,
  department,
  onChangeDepartment,
  job,
  onChangeJob,
  onSubmit,
}: {
  companyName: string;
  onChangeCompanyName: (v: string) => void;
  department: string;
  onChangeDepartment: (v: string) => void;
  job: string;
  onChangeJob: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-6">
        {/* 타이틀 */}
        <div className="flex items-center gap-2 pt-4">
          <h2 className="text-heading-lg font-semibold text-text-primary">회사정보 입력</h2>
          <span className="text-body text-text-tertiary">(선택)</span>
        </div>

        <Input
          value={companyName}
          onChange={e => onChangeCompanyName(e.target.value)}
          placeholder="회사명"
          className="h-11"
        />
        <Input
          value={department}
          onChange={e => onChangeDepartment(e.target.value)}
          placeholder="부서명"
          className="h-11"
        />
        <Input
          value={job}
          onChange={e => onChangeJob(e.target.value)}
          placeholder="직급"
          className="h-11"
        />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onSubmit}
        >
          다음
        </Button>
      </div>
    </div>
  );
}

/* ─── Confetti Lottie (한번 재생 → 딜레이 → 반복) ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConfettiLottie = forwardRef<
  { play: () => void },
  { animationData: any; onComplete: () => void }
>(function ConfettiLottie({ animationData, onComplete }, ref) {
  const lottieRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    play: () => lottieRef.current?.goToAndPlay(0),
  }));

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={false}
      autoplay
      onComplete={onComplete}
      style={{ width: '100%', height: '100%' }}
    />
  );
});

/* ─── Step 5: 가입 완료 ─── */
function CompleteStep({ userName }: { userName: string }) {
  const { showLoadingOverlay, hideLoadingOverlay } = useUIStore();
  const lottieRef = useRef<{ play: () => void } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [confettiData, setConfettiData] = useState<any>(null);

  useEffect(() => {
    fetch('/center-confetti.json')
      .then(res => res.json())
      .then(setConfettiData)
      .catch(() => {});
  }, []);

  const handleComplete = useCallback(() => {
    setTimeout(() => {
      lottieRef.current?.play();
    }, 500);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
      {/* 이미지 + 텍스트 그룹 */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative overflow-visible">
          {/* 꽃가루 Lottie */}
          {confettiData && (
            <div className="absolute inset-0 bottom-10" style={{ transform: 'scale(2.1)' }}>
              <ConfettiLottie
                ref={lottieRef}
                animationData={confettiData}
                onComplete={handleComplete}
              />
            </div>
          )}
          {/* 벌 이미지 */}
          <img
            src="/signup-complete.png"
            alt="가입 완료"
            className="relative h-[110px] w-[125px] object-contain"
          />
        </div>

        {/* 텍스트 그룹 */}
        <div className="flex flex-col items-center gap-[5px]">
          <span className="text-body font-medium text-[#F2A500]">가입 완료 !</span>
          <span className="text-heading-sm font-semibold text-text-primary">
            {userName}님, 환영해요
          </span>
        </div>
      </div>

      {/* 버튼 */}
      <div className="mt-12 w-full space-y-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => { window.location.href = '/login'; }}
        >
          로그인 페이지로 가기
        </Button>

        {/* TODO: 로딩 오버레이 확인용 임시 버튼 — 확인 후 삭제 */}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => {
            showLoadingOverlay({ message: '회원가입 중입니다...' });
            setTimeout(() => hideLoadingOverlay(), 3000);
          }}
        >
          [테스트] 로딩 오버레이 미리보기
        </Button>
      </div>
    </div>
  );
}

/* ─── Clear Icon (X) ─── */
function ClearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </svg>
  );
}

/* ─── Eye Icon ─── */
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

/* ─── 메인 페이지 ─── */
export default function SignupPage() {
  const { showSnackbar, showLoadingOverlay, hideLoadingOverlay } = useUIStore();

  const [step, setStep] = useState<Step>('TERMS');
  const [terms, setTerms] = useState<SignupTerm[]>([]);
  const [agreedTermIds, setAgreedTermIds] = useState<Set<number>>(new Set());
  const [termsLoaded, setTermsLoaded] = useState(false);

  // 휴대폰 인증
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // 개인정보
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // 회사정보
  const [companyName, setCompanyName] = useState('');
  const [department, setDepartment] = useState('');
  const [job, setJob] = useState('');

  // 약관 로드
  useEffect(() => {
    if (termsLoaded) return;
    const load = async () => {
      try {
        const res = await apiGetSignupTerms('INDIVIDUAL');
        setTerms(res.payload.items);
        setTermsLoaded(true);
      } catch {
        showSnackbar({ message: '약관 정보를 불러올 수 없습니다.', state: 'error' });
      }
    };
    load();
  }, [termsLoaded, showSnackbar]);

  const toggleTerm = useCallback((id: number) => {
    setAgreedTermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllTerms = useCallback(() => {
    setAgreedTermIds(prev =>
      prev.size === terms.length ? new Set() : new Set(terms.map(t => t.id)),
    );
  }, [terms]);

  const handleBack = () => {
    const prevStep: Record<Step, Step | 'login'> = {
      TERMS: 'login',
      PHONE: 'TERMS',
      PERSONAL: 'PHONE',
      COMPANY: 'PERSONAL',
      COMPLETE: 'COMPANY',
    };
    const prev = prevStep[step];
    if (prev === 'login') {
      window.location.href = '/login';
    } else {
      setStep(prev);
    }
  };

  const handleSignup = async () => {
    const termsList: SignupTermItem[] = [...agreedTermIds].map(id => ({
      id,
      isAgreed: true,
    }));

    showLoadingOverlay({ message: '회원가입 중입니다...' });
    try {
      await apiSignup('INDIVIDUAL', {
        email,
        name: name.trim(),
        password,
        passwordConfirm,
        ...parsePhoneParts(phone),
        department: department.trim() || undefined,
        job: job.trim() || undefined,
        termsList,
      });
      setStep('COMPLETE');
    } catch (err) {
      const msg = isApiError(err) ? err.message : '회원가입에 실패했습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      hideLoadingOverlay();
    }
  };

  // 완료 화면
  if (step === 'COMPLETE') {
    return (
      <div className="flex flex-1 flex-col bg-white">
        <CompleteStep userName={name} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* 헤더 */}
      <div className="flex h-14 items-center gap-2 px-4">
        <BackButton onClick={handleBack} />
        <span className="text-heading-lg font-semibold text-text-primary">
          {STEP_TITLE[step]}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="px-4">
        <ProgressBar current={STEP_PROGRESS[step]} total={TOTAL_STEPS} />
      </div>

      {/* Step Content */}
      {step === 'TERMS' && !termsLoaded && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-primary" />
        </div>
      )}

      {step === 'TERMS' && termsLoaded && (
        <TermsStep
          terms={terms}
          agreedTermIds={agreedTermIds}
          onToggle={toggleTerm}
          onToggleAll={toggleAllTerms}
          onNext={() => setStep('PHONE')}
        />
      )}

      {step === 'PHONE' && (
        <PhoneStep
          name={name}
          onChangeName={setName}
          phone={phone}
          onChangePhone={setPhone}
          onNext={() => setStep('PERSONAL')}
        />
      )}

      {step === 'PERSONAL' && (
        <PersonalInfoStep
          email={email}
          onChangeEmail={setEmail}
          password={password}
          onChangePassword={setPassword}
          passwordConfirm={passwordConfirm}
          onChangePasswordConfirm={setPasswordConfirm}
          onNext={() => setStep('COMPANY')}
        />
      )}

      {step === 'COMPANY' && (
        <CompanyStep
          companyName={companyName}
          onChangeCompanyName={setCompanyName}
          department={department}
          onChangeDepartment={setDepartment}
          job={job}
          onChangeJob={setJob}
          onSubmit={handleSignup}
        />
      )}
    </div>
  );
}

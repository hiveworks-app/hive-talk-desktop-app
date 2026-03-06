'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  apiGetSignupTerms,
  apiSignup,
} from '@/features/signup/api';
import type { SignupTerm, SignupTermItem } from '@/features/signup/type';
import { isApiError } from '@/shared/api';
import { parsePhoneParts } from '@/shared/utils/phone';
import { useUIStore } from '@/store';
import { TermsStep } from './_components/TermsStep';
import { PhoneStep } from './_components/PhoneStep';
import { PersonalInfoStep } from './_components/PersonalInfoStep';
import { CompanyStep } from './_components/CompanyStep';
import { CompleteStep } from './_components/CompleteStep';

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

'use client';

import { IconChevronLeft } from '@/shared/ui/icons';
import { TermsStep } from './_components/TermsStep';
import { PhoneStep } from './_components/PhoneStep';
import { PersonalInfoStep } from './_components/PersonalInfoStep';
import { CompanyStep } from './_components/CompanyStep';
import { CompleteStep } from './_components/CompleteStep';
import { useSignupForm } from './useSignupForm';
import type { Step } from './useSignupForm';

const STEP_PROGRESS: Record<Exclude<Step, 'COMPLETE'>, number> = { TERMS: 1, PHONE: 2, PERSONAL: 3, COMPANY: 4 };
const TOTAL_STEPS = 4;

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-gray-200">
      <div className="h-1 rounded-full bg-primary transition-all duration-300" style={{ width: `${(current / total) * 100}%` }} />
    </div>
  );
}

export default function SignupPage() {
  const {
    step, setStep, terms, agreedTermIds, termsLoaded,
    name, setName, phone, setPhone,
    email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm,
    companyName, setCompanyName, department, setDepartment, job, setJob,
    toggleTerm, toggleAllTerms, handleBack, handleSignup,
  } = useSignupForm();

  if (step === 'COMPLETE') {
    return <div className="flex flex-1 flex-col bg-white"><CompleteStep userName={name} /></div>;
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="flex h-14 items-center gap-2 px-4">
        <button onClick={handleBack} className="text-text-primary hover:text-text-secondary">
          <IconChevronLeft size={24} />
        </button>
        <span className="text-heading-lg font-semibold text-text-primary">회원가입</span>
      </div>

      <div className="px-4"><ProgressBar current={STEP_PROGRESS[step]} total={TOTAL_STEPS} /></div>

      {step === 'TERMS' && !termsLoaded && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-primary" />
        </div>
      )}

      {step === 'TERMS' && termsLoaded && (
        <TermsStep terms={terms} agreedTermIds={agreedTermIds} onToggle={toggleTerm} onToggleAll={toggleAllTerms} onNext={() => setStep('PHONE')} />
      )}

      {step === 'PHONE' && (
        <PhoneStep name={name} onChangeName={setName} phone={phone} onChangePhone={setPhone} onNext={() => setStep('PERSONAL')} />
      )}

      {step === 'PERSONAL' && (
        <PersonalInfoStep
          email={email} onChangeEmail={setEmail}
          password={password} onChangePassword={setPassword}
          passwordConfirm={passwordConfirm} onChangePasswordConfirm={setPasswordConfirm}
          onNext={() => setStep('COMPANY')}
        />
      )}

      {step === 'COMPANY' && (
        <CompanyStep
          companyName={companyName} onChangeCompanyName={setCompanyName}
          department={department} onChangeDepartment={setDepartment}
          job={job} onChangeJob={setJob} onSubmit={handleSignup}
        />
      )}
    </div>
  );
}

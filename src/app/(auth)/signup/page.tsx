'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiGetSignupTerms,
  apiCheckEmail,
  apiSignup,
  apiSendSms,
  apiVerifySms,
  apiVerifyBusiness,
} from '@/features/signup/api';
import type {
  MemberType,
  SignupTerm,
  SignupTermItem,
} from '@/features/signup/type';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';

type Step = 'SELECT_TYPE' | 'TERMS' | 'CORPORATE_INFO' | 'COMMON_FORM';

export default function SignupPage() {
  const router = useRouter();
  const { showSnackbar } = useUIStore();

  const [step, setStep] = useState<Step>('SELECT_TYPE');
  const [memberType, setMemberType] = useState<MemberType>('CORPORATE');
  const [terms, setTerms] = useState<SignupTerm[]>([]);
  const [agreedTermIds, setAgreedTermIds] = useState<Set<number>>(new Set());

  // 기업 정보
  const [brn, setBrn] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [openingAt, setOpeningAt] = useState('');
  const [businessVerified, setBusinessVerified] = useState(false);

  // 회원 정보
  const [email, setEmail] = useState('');
  const [emailChecked, setEmailChecked] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phoneHead, setPhoneHead] = useState('010');
  const [phoneMid, setPhoneMid] = useState('');
  const [phoneTail, setPhoneTail] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [department, setDepartment] = useState('');
  const [job, setJob] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // Step 1: 유형 선택
  const handleSelectType = async (type: MemberType) => {
    setMemberType(type);
    setIsLoading(true);
    try {
      const res = await apiGetSignupTerms(type);
      setTerms(res.payload.items);
      setAgreedTermIds(new Set());
      setStep('TERMS');
    } catch {
      showSnackbar({ message: '약관 정보를 불러올 수 없습니다.', state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 약관 동의
  const requiredTerms = terms.filter(t => t.isRequired);
  const allRequiredAgreed = requiredTerms.every(t => agreedTermIds.has(t.id));

  const toggleTerm = (id: number) => {
    setAgreedTermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTerms = () => {
    if (agreedTermIds.size === terms.length) {
      setAgreedTermIds(new Set());
    } else {
      setAgreedTermIds(new Set(terms.map(t => t.id)));
    }
  };

  const handleTermsNext = () => {
    if (!allRequiredAgreed) {
      showSnackbar({ message: '필수 약관에 모두 동의해 주세요.', state: 'error' });
      return;
    }
    setStep(memberType === 'CORPORATE' ? 'CORPORATE_INFO' : 'COMMON_FORM');
  };

  // Step 3: 기업 정보 인증
  const handleVerifyBusiness = async () => {
    if (!brn || !companyName || !ceoName || !openingAt) {
      showSnackbar({ message: '모든 항목을 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiVerifyBusiness({ brn, companyName, ceoName, openingAt });
      setBusinessVerified(true);
      showSnackbar({ message: '사업자 인증이 완료되었습니다.', state: 'success' });
    } catch (err) {
      const msg = isApiError(err) ? err.message : '사업자 인증에 실패했습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: 이메일 중복 체크
  const handleCheckEmail = async () => {
    if (!email.includes('@')) {
      showSnackbar({ message: '올바른 이메일을 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiCheckEmail(email);
      setEmailChecked(true);
      showSnackbar({ message: '사용 가능한 이메일입니다.', state: 'success' });
    } catch (err) {
      const msg = isApiError(err) ? err.message : '이미 사용 중인 이메일입니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // SMS 인증
  const handleSendSms = async () => {
    if (!phoneHead || !phoneMid || !phoneTail) {
      showSnackbar({ message: '전화번호를 모두 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiSendSms({ phoneHead, phoneMid, phoneTail });
      setSmsSent(true);
      showSnackbar({ message: '인증번호가 발송되었습니다.', state: 'success' });
    } catch {
      showSnackbar({ message: 'SMS 발송에 실패했습니다.', state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySms = async () => {
    if (smsCode.length < 6) {
      showSnackbar({ message: '인증번호 6자리를 입력해 주세요.', state: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      await apiVerifySms({ phoneHead, phoneMid, phoneTail, code: smsCode });
      setSmsVerified(true);
      showSnackbar({ message: '전화번호 인증이 완료되었습니다.', state: 'success' });
    } catch {
      showSnackbar({ message: '인증번호가 올바르지 않습니다.', state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // 회원가입 제출
  const handleSubmit = async () => {
    if (!emailChecked) {
      showSnackbar({ message: '이메일 중복 확인을 해주세요.', state: 'error' });
      return;
    }
    if (!name.trim()) {
      showSnackbar({ message: '이름을 입력해 주세요.', state: 'error' });
      return;
    }
    if (password.length < 8) {
      showSnackbar({ message: '비밀번호는 8자 이상이어야 합니다.', state: 'error' });
      return;
    }
    if (password !== passwordConfirm) {
      showSnackbar({ message: '비밀번호가 일치하지 않습니다.', state: 'error' });
      return;
    }
    if (!smsVerified) {
      showSnackbar({ message: '전화번호 인증을 완료해 주세요.', state: 'error' });
      return;
    }

    const termsList: SignupTermItem[] = terms.map(t => ({
      termId: t.id,
      version: t.version,
      isAgreed: agreedTermIds.has(t.id),
    }));

    setIsLoading(true);
    try {
      await apiSignup(memberType, {
        email,
        name: name.trim(),
        password,
        passwordConfirm,
        phoneHead,
        phoneMid,
        phoneTail,
        department: department.trim() || undefined,
        job: job.trim() || undefined,
        termsList,
        ...(memberType === 'CORPORATE' ? { brn, companyName, ceoName, openingAt } : {}),
      });
      showSnackbar({ message: '회원가입이 완료되었습니다. 로그인해 주세요.', state: 'success' });
      router.push('/login');
    } catch (err) {
      const msg = isApiError(err) ? err.message : '회원가입에 실패했습니다.';
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitle: Record<Step, string> = {
    SELECT_TYPE: '회원 유형 선택',
    TERMS: '약관 동의',
    CORPORATE_INFO: '기업 정보 인증',
    COMMON_FORM: '회원 정보 입력',
  };

  const stepIndex = ['SELECT_TYPE', 'TERMS', 'CORPORATE_INFO', 'COMMON_FORM'].indexOf(step);
  const totalSteps = memberType === 'CORPORATE' ? 4 : 3;
  const currentStepNum =
    memberType === 'CORPORATE'
      ? stepIndex + 1
      : step === 'SELECT_TYPE' ? 1 : step === 'TERMS' ? 2 : 3;

  return (
    <div className="flex flex-1 items-center justify-center bg-state-primary-highlighted">
      <div className="w-full max-w-[480px] rounded-2xl bg-surface p-8 shadow-lg">
        {/* 로고 + 뒤로가기 */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'SELECT_TYPE') router.push('/login');
              else if (step === 'TERMS') setStep('SELECT_TYPE');
              else if (step === 'CORPORATE_INFO') setStep('TERMS');
              else setStep(memberType === 'CORPORATE' ? 'CORPORATE_INFO' : 'TERMS');
            }}
            className="text-text-tertiary hover:text-text-secondary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-heading-md font-bold text-primary">HIVE-TALK</h1>
          <div className="w-5" />
        </div>

        {/* 단계 표시 */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-heading-sm font-bold text-text-primary">{stepTitle[step]}</h2>
            <span className="text-sub-sm text-text-tertiary">
              {currentStepNum} / {totalSteps}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-gray-200">
            <div
              className="h-1 rounded-full bg-primary transition-all"
              style={{ width: `${(currentStepNum / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: 유형 선택 */}
        {step === 'SELECT_TYPE' && (
          <div className="space-y-3">
            <TypeCard
              title="기업 회원"
              description="사업자등록번호로 기업 인증 후 가입합니다"
              selected={false}
              onClick={() => handleSelectType('CORPORATE')}
              disabled={isLoading}
            />
            <TypeCard
              title="개인 회원"
              description="개인 사용자로 가입합니다"
              selected={false}
              onClick={() => handleSelectType('INDIVIDUAL')}
              disabled={isLoading}
            />
            {isLoading && <p className="text-center text-sub-sm text-text-tertiary">로딩 중...</p>}
          </div>
        )}

        {/* Step 2: 약관 동의 */}
        {step === 'TERMS' && (
          <div>
            <button
              onClick={toggleAllTerms}
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-divider px-4 py-3 text-left"
            >
              <Checkbox checked={agreedTermIds.size === terms.length} />
              <span className="text-sub font-medium text-text-primary">전체 동의</span>
            </button>

            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {terms.map(term => (
                <button
                  key={term.id}
                  onClick={() => toggleTerm(term.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-4 py-2 text-left hover:bg-surface-pressed"
                >
                  <Checkbox checked={agreedTermIds.has(term.id)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sub text-text-primary">{term.title}</span>
                      {term.isRequired && (
                        <span className="text-sub-sm text-red-500">(필수)</span>
                      )}
                    </div>
                    {term.description && (
                      <p className="mt-0.5 text-sub-sm text-text-tertiary line-clamp-2">{term.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleTermsNext}
              disabled={!allRequiredAgreed}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled disabled:text-text-placeholder"
            >
              다음
            </button>
          </div>
        )}

        {/* Step 3: 기업 정보 인증 */}
        {step === 'CORPORATE_INFO' && (
          <div className="space-y-3">
            <FormField label="사업자등록번호" value={brn} onChange={setBrn} placeholder="000-00-00000" />
            <FormField label="회사명" value={companyName} onChange={setCompanyName} />
            <FormField label="대표자명" value={ceoName} onChange={setCeoName} />
            <FormField label="개업일자" value={openingAt} onChange={setOpeningAt} placeholder="YYYY-MM-DD" />

            {!businessVerified ? (
              <button
                onClick={handleVerifyBusiness}
                disabled={isLoading}
                className="w-full rounded-lg border border-primary py-2.5 text-sub font-semibold text-primary hover:bg-state-primary-highlighted disabled:opacity-50"
              >
                {isLoading ? '인증 중...' : '사업자 인증'}
              </button>
            ) : (
              <p className="text-center text-sub font-medium text-green-600">사업자 인증 완료</p>
            )}

            <button
              onClick={() => setStep('COMMON_FORM')}
              disabled={!businessVerified}
              className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled disabled:text-text-placeholder"
            >
              다음
            </button>
          </div>
        )}

        {/* Step 4: 회원 정보 입력 */}
        {step === 'COMMON_FORM' && (
          <div className="space-y-3">
            {/* 이메일 */}
            <div>
              <label className="mb-1 block text-sub-sm font-medium text-text-secondary">이메일 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailChecked(false); }}
                  placeholder="email@example.com"
                  className="flex-1 rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none focus:border-primary"
                />
                <button
                  onClick={handleCheckEmail}
                  disabled={isLoading || emailChecked}
                  className="shrink-0 rounded-lg border border-primary px-3 py-2 text-sub-sm font-medium text-primary disabled:opacity-50"
                >
                  {emailChecked ? '확인됨' : '중복확인'}
                </button>
              </div>
            </div>

            <FormField label="이름" value={name} onChange={setName} required />
            <FormField label="비밀번호" value={password} onChange={setPassword} type="password" required placeholder="8자 이상, 영문+숫자+특수문자" />
            <FormField label="비밀번호 확인" value={passwordConfirm} onChange={setPasswordConfirm} type="password" required />

            {/* 전화번호 */}
            <div>
              <label className="mb-1 block text-sub-sm font-medium text-text-secondary">전화번호 <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={phoneHead}
                  onChange={e => setPhoneHead(e.target.value)}
                  maxLength={3}
                  className="w-16 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub outline-none focus:border-primary"
                />
                <span className="text-text-tertiary">-</span>
                <input
                  type="text"
                  value={phoneMid}
                  onChange={e => setPhoneMid(e.target.value)}
                  maxLength={4}
                  className="w-20 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub outline-none focus:border-primary"
                />
                <span className="text-text-tertiary">-</span>
                <input
                  type="text"
                  value={phoneTail}
                  onChange={e => setPhoneTail(e.target.value)}
                  maxLength={4}
                  className="w-20 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub outline-none focus:border-primary"
                />
                <button
                  onClick={smsSent ? handleVerifySms : handleSendSms}
                  disabled={isLoading || smsVerified}
                  className="shrink-0 rounded-lg border border-primary px-3 py-2 text-sub-sm font-medium text-primary disabled:opacity-50"
                >
                  {smsVerified ? '인증됨' : smsSent ? '확인' : '인증'}
                </button>
              </div>
              {smsSent && !smsVerified && (
                <input
                  type="text"
                  value={smsCode}
                  onChange={e => setSmsCode(e.target.value)}
                  placeholder="인증번호 6자리"
                  maxLength={6}
                  className="mt-2 w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub outline-none focus:border-primary"
                />
              )}
            </div>

            <FormField label="부서" value={department} onChange={setDepartment} />
            <FormField label="직책" value={job} onChange={setJob} />

            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled disabled:text-text-placeholder"
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeCard({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-divider px-5 py-4 text-left transition-colors hover:border-primary hover:bg-state-primary-highlighted disabled:opacity-50"
    >
      <div className="text-sub font-bold text-text-primary">{title}</div>
      <p className="mt-1 text-sub-sm text-text-tertiary">{description}</p>
    </button>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        checked ? 'border-primary bg-primary' : 'border-gray-300'
      }`}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sub-sm font-medium text-text-secondary">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none focus:border-primary"
      />
    </div>
  );
}

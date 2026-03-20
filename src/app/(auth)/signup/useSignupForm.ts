'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiGetSignupTerms, apiSignup } from '@/features/signup/api';
import type { SignupTerm, SignupTermItem } from '@/features/signup/type';
import { getErrorMessage } from '@/shared/api';
import { parsePhoneParts } from '@/shared/utils/phone';
import { useUIStore } from '@/store';

type Step = 'TERMS' | 'PHONE' | 'PERSONAL' | 'COMPANY' | 'COMPLETE';

export function useSignupForm() {
  const { showSnackbar, showLoadingOverlay, hideLoadingOverlay } = useUIStore();

  const [step, setStep] = useState<Step>('TERMS');
  const [terms, setTerms] = useState<SignupTerm[]>([]);
  const [agreedTermIds, setAgreedTermIds] = useState<Set<number>>(new Set());
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [department, setDepartment] = useState('');
  const [job, setJob] = useState('');

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
    setAgreedTermIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const toggleAllTerms = useCallback(() => {
    setAgreedTermIds(prev => (prev.size === terms.length ? new Set() : new Set(terms.map(t => t.id))));
  }, [terms]);

  const handleBack = () => {
    const prevStep: Record<Step, Step | 'login'> = { TERMS: 'login', PHONE: 'TERMS', PERSONAL: 'PHONE', COMPANY: 'PERSONAL', COMPLETE: 'COMPANY' };
    const prev = prevStep[step];
    if (prev === 'login') window.location.href = '/login';
    else setStep(prev);
  };

  const handleSignup = async () => {
    const termsList: SignupTermItem[] = [...agreedTermIds].map(id => ({ id, isAgreed: true }));
    showLoadingOverlay({ message: '회원가입 중입니다...' });
    try {
      await apiSignup('INDIVIDUAL', {
        email, name: name.trim(), password, passwordConfirm,
        ...parsePhoneParts(phone),
        department: department.trim() || undefined,
        job: job.trim() || undefined,
        termsList,
      });
      setStep('COMPLETE');
    } catch (err) {
      const msg = getErrorMessage(err, '회원가입에 실패했습니다.');
      showSnackbar({ message: msg, state: 'error' });
    } finally {
      hideLoadingOverlay();
    }
  };

  return {
    step, setStep, terms, agreedTermIds, termsLoaded,
    name, setName, phone, setPhone,
    email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm,
    companyName, setCompanyName, department, setDepartment, job, setJob,
    toggleTerm, toggleAllTerms, handleBack, handleSignup,
  };
}

export type { Step };

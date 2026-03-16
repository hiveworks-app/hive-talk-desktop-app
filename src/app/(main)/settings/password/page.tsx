'use client';

import { IconChevronLeft } from '@/shared/ui/icons';
import { useChangePassword } from './useChangePassword';

export default function ChangePasswordPage() {
  const {
    step, code, setCode, password, setPassword, passwordConfirm, setPasswordConfirm,
    isLoading, userEmail, stepNum, goBack, handleSendCode, handleVerifyCode, handleChangePassword,
  } = useChangePassword();

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button onClick={goBack} className="text-text-tertiary hover:text-text-secondary">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">비밀번호 변경</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[400px]">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sub font-medium text-text-primary">
                {step === 'EMAIL' ? '이메일 인증' : step === 'CODE' ? '코드 확인' : '새 비밀번호'}
              </span>
              <span className="text-sub-sm text-text-tertiary">{stepNum} / 3</span>
            </div>
            <div className="h-1 w-full rounded-full bg-gray-200">
              <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(stepNum / 3) * 100}%` }} />
            </div>
          </div>

          {step === 'EMAIL' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">등록된 이메일로 인증 코드를 발송합니다.</p>
              <div className="rounded-lg border border-divider bg-surface px-4 py-3">
                <span className="text-sub-sm text-text-tertiary">등록 이메일</span>
                <div className="mt-1 text-sub font-medium text-text-primary">{userEmail ?? '-'}</div>
              </div>
              <button onClick={handleSendCode} disabled={isLoading} className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled">
                {isLoading ? '발송 중...' : '인증 코드 발송'}
              </button>
            </div>
          )}

          {step === 'CODE' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">이메일로 발송된 인증번호 6자리를 입력해 주세요.</p>
              <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" maxLength={6}
                className="w-full rounded-lg border border-divider bg-surface px-4 py-3 text-center text-heading-lg tracking-[0.5em] text-text-primary outline-none focus:border-primary" />
              <button onClick={handleVerifyCode} disabled={isLoading || code.length < 6} className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled">
                {isLoading ? '확인 중...' : '확인'}
              </button>
              <button onClick={handleSendCode} disabled={isLoading} className="w-full text-sub-sm text-text-tertiary hover:underline">인증 코드 재발송</button>
            </div>
          )}

          {step === 'PASSWORD' && (
            <div className="space-y-4">
              <p className="text-sub text-text-secondary">새 비밀번호를 입력해 주세요. (8자 이상, 영문+숫자+특수문자)</p>
              <div>
                <label className="mb-1 block text-sub-sm font-medium text-text-secondary">새 비밀번호</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-surface px-3 py-2.5 text-sub text-text-primary outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sub-sm font-medium text-text-secondary">비밀번호 확인</label>
                <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-surface px-3 py-2.5 text-sub text-text-primary outline-none focus:border-primary" />
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="mt-1 text-sub-sm text-red-500">비밀번호가 일치하지 않습니다</p>
                )}
              </div>
              <button onClick={handleChangePassword} disabled={isLoading || password.length < 8 || password !== passwordConfirm}
                className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary disabled:bg-disabled">
                {isLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

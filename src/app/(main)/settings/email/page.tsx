'use client';

import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import IconArrowBack from '@assets/icons/arrow_back.svg';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { cn } from '@/shared/lib/cn';
import { IconCheck } from '@/shared/ui/icons';
import { Spinner } from '@/shared/ui/Spinner';
import { SettingsOverlay } from '../_components/SettingsOverlay';
import { useChangeEmail } from './useChangeEmail';

export default function ChangeEmailPage() {
  const {
    step,
    email,
    code,
    emailError,
    codeError,
    codeLocked,
    isSending,
    isVerifying,
    timer,
    handleEmailChange,
    handleCodeChange,
    handleSendCode,
    handleVerifyAndChange,
    pendingChangeEmail,
    confirmChange,
    cancelChange,
    goBack,
    close,
    goToAccountDetail,
  } = useChangeEmail();

  const isBusy = isSending || isVerifying;
  // 인증번호 6자리 + 타이머 유효 + 오답/잠금 아님 + 비요청 상태일 때만 완료 가능
  const canComplete =
    step === 'CODE' && code.length === 6 && timer.isRunning && !isBusy && !codeError;
  // 이메일 입력이 있고 요청 중이 아닐 때만 인증요청(파란색) 활성화
  const canRequestCode = !isBusy && email.trim().length > 0;

  // 5회 잠금 또는 시간초과 → 코드 입력 비활성(회색). 시간초과는 타이머에서 파생.
  const codeDisabled = codeLocked || timer.isExpired;
  const codeErrorMessage =
    codeError || (timer.isExpired ? '인증시간이 만료되었습니다. 재요청 버튼을 눌러주세요.' : '');

  return (
    <SettingsOverlay bg="bg-background">
      {/* TopBar — ←(이전 단계/상세) / 중앙 타이틀 / X. 완료(DONE) 화면은 ← 제거, X→계정정보 */}
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        {step !== 'DONE' && (
          <button
            onClick={goBack}
            className="electron-no-drag absolute left-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
            aria-label={step === 'CODE' ? '이전 단계' : '뒤로가기'}
          >
            <IconArrowBack width={20} height={20} />
          </button>
        )}
        <h2 className="text-heading-md font-medium text-text-primary">이메일</h2>
        <button
          onClick={step === 'DONE' ? goToAccountDetail : close}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      {step === 'DONE' ? (
        /* ── 변경 완료 화면 (← 없음, X→계정정보) ── */
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-5">
              <div className="flex size-[50px] items-center justify-center rounded-full bg-blue-100">
                <IconCheck size={24} className="text-primary" />
              </div>
              <p className="text-heading-md font-semibold text-text-primary">
                이메일(아이디) 변경 완료
              </p>
            </div>
            <div className="flex w-full items-center justify-center rounded-xl bg-gray-100 px-4 py-[30px]">
              <p className="text-body font-medium text-text-primary">{email}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex max-w-[400px] flex-col gap-6">
            <h1 className="text-heading-xl font-semibold text-text-primary">이메일 변경</h1>

          <div className="flex flex-col gap-3">
            {/* 이메일 입력 + 인라인 인증요청 + 안내멘트 */}
            <div className="flex flex-col gap-2">
              <div
                className={`flex h-10 items-center gap-2 rounded-[10px] border bg-surface px-4 transition ${
                  emailError
                    ? 'border-state-error ring-1 ring-inset ring-state-error'
                    : 'border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary'
                }`}
              >
                <input
                  type="email"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendCode();
                  }}
                  placeholder="변경할 이메일을 입력해주세요."
                  autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-body font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
                />
                <button
                  onClick={handleSendCode}
                  disabled={!canRequestCode}
                  className={cn(
                    'flex h-7 min-w-[64px] shrink-0 items-center justify-center rounded-md px-3.5 text-sub font-medium transition-colors',
                    isSending
                      ? 'bg-blue-100 text-blue-500' // 진행중: blue 100 배경 + 스피너
                      : canRequestCode
                        ? 'bg-blue-100 text-blue-500 active:bg-blue-300' // 활성: blue 100, press 시 blue 300
                        : 'bg-gray-100 text-gray-600', // 비활성: gray 100(#F3F5F8) 배경 + gray 600 글자
                  )}
                >
                  {isSending ? <Spinner /> : step === 'EMAIL' ? '인증요청' : '재요청'}
                </button>
              </div>
              {emailError ? (
                <p className="text-sub font-medium text-state-error">{emailError}</p>
              ) : (
                step === 'CODE' &&
                !codeErrorMessage && (
                  <p className="text-sub font-medium text-primary">
                    이메일로 발송된 인증번호를 확인해주세요.
                  </p>
                )
              )}
            </div>

            {/* 인증번호 입력 + 유효시간 타이머 + 오답/잠금 에러 (코드 발송 후 노출) */}
            {step === 'CODE' && (
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-[10px] border px-4 transition',
                    codeDisabled
                      ? 'border-outline bg-disabled' // 5회 실패/시간초과: 비활성 회색(#F8F9FA, 다크모드 대응)
                      : codeError
                        ? 'border-state-error bg-surface ring-1 ring-inset ring-state-error' // 오답: 빨강 2px
                        : 'border-outline bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary', // 정상
                  )}
                >
                  <input
                    type="text"
                    value={code}
                    onChange={e => handleCodeChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canComplete) handleVerifyAndChange();
                    }}
                    placeholder="인증번호 6자리"
                    maxLength={6}
                    inputMode="numeric"
                    disabled={codeDisabled}
                    autoFocus
                    className={cn(
                      'min-w-0 flex-1 bg-transparent text-body font-medium tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:font-normal placeholder:text-text-placeholder',
                      codeDisabled ? 'text-text-tertiary' : 'text-text-primary',
                    )}
                  />
                  {timer.formattedTime && (
                    <span
                      className={cn(
                        'shrink-0 text-body font-medium tabular-nums',
                        codeErrorMessage ? 'text-text-tertiary' : 'text-primary',
                      )}
                    >
                      {timer.formattedTime}
                    </span>
                  )}
                </div>
                {codeErrorMessage && (
                  <p className="text-sub font-medium text-state-error">{codeErrorMessage}</p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleVerifyAndChange}
            disabled={!canComplete}
            className="h-10 w-full rounded-[10px] bg-primary text-body font-medium text-on-primary transition-colors disabled:bg-gray-400"
          >
            {isVerifying ? '변경 중...' : '완료'}
          </button>
        </div>
      </div>
      )}
      {/* 최종 변경 확인 (RN Alert 패리티) */}
      <ConfirmDialog
        open={pendingChangeEmail !== null}
        title="이메일을 변경할까요?"
        description={pendingChangeEmail ? `${pendingChangeEmail}(으)로 변경돼요.` : ''}
        confirmLabel="변경"
        cancelLabel="취소"
        onConfirm={() => void confirmChange()}
        onCancel={cancelChange}
      />
    </SettingsOverlay>
  );
}

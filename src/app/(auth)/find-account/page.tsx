"use client";

import { useCallback, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/shared/lib/cn";
import { useFindLoginId } from "@/features/find-login-id/useFindLoginId";
import { useFindPassword } from "@/features/find-password/useFindPassword";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

/* ─── SMS 인증 섹션 (공용) ─── */
function SmsVerificationSection({
  verificationCode,
  onChangeVerificationCode,
  timerText,
  isExpired,
  isVerified,
  isVerifying,
  canVerify,
  onVerify,
}: {
  verificationCode: string;
  onChangeVerificationCode: (text: string) => void;
  timerText: string;
  isExpired: boolean;
  isVerified: boolean;
  isVerifying: boolean;
  canVerify: boolean;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={verificationCode}
          onChange={(e) => onChangeVerificationCode(e.target.value)}
          placeholder="인증번호 6자리"
          maxLength={6}
          inputMode="numeric"
          className="h-11 pr-16"
        />
        {timerText && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sub font-semibold text-state-error">
            {timerText}
          </span>
        )}
      </div>
      {isExpired && (
        <p className="text-sub-sm text-state-error">
          인증시간이 만료되었습니다. 재발송 버튼을 눌러주세요.
        </p>
      )}
      {!isVerified && !isExpired && (
        <Button
          variant="primary"
          size="sm"
          onClick={onVerify}
          disabled={!canVerify}
        >
          {isVerifying ? "확인 중..." : "인증확인"}
        </Button>
      )}
      {isVerified && (
        <p className="text-sub-sm text-state-success">인증이 완료되었습니다.</p>
      )}
    </div>
  );
}

/* ─── 아이디 찾기 탭 ─── */
function FindIdContent({
  onFoundEmail,
}: {
  onFoundEmail: (email: string) => void;
}) {
  const {
    step,
    name,
    phone,
    verificationCode,
    isCodeSent,
    isVerified,
    isSending,
    isVerifying,
    foundEmail,
    timer,
    canSendCode,
    canVerify,
    setName,
    handlePhoneChange,
    setVerificationCode,
    handleSendCode,
    handleVerifyCode,
    handleSubmit,
  } = useFindLoginId();

  const handleGoToFindPassword = useCallback(() => {
    onFoundEmail(foundEmail);
  }, [foundEmail, onFoundEmail]);

  const handleGoToLogin = useCallback(() => {
    window.location.href = "/login";
  }, []);

  if (step === "result") {
    return (
      <div className="flex flex-1 flex-col px-4">
        <div className="flex-1 space-y-[30px] pt-[30px]">
          <div className="space-y-2">
            <h2 className="text-heading-lg font-semibold text-text-primary">
              아이디 찾기 결과
            </h2>
            <p className="text-sub text-text-tertiary">
              회원님의 아이디를 찾았어요.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-outline p-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-primary"
            >
              <path
                d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 6l-10 7L2 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-heading-md font-semibold text-text-primary">
              {foundEmail}
            </p>
          </div>
        </div>

        <div className="space-y-2 pb-4">
          <Button
            variant="ghost"
            fullWidth
            onClick={handleGoToFindPassword}
          >
            비밀번호 찾기
          </Button>
          <Button variant="primary" fullWidth onClick={handleGoToLogin}>
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex-1 space-y-5 pt-[30px]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="h-11"
        />

        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="휴대전화(-없이)"
            inputMode="numeric"
            maxLength={11}
            className="h-11 flex-1"
          />
          <Button
            variant="secondary"
            size="lg"
            onClick={handleSendCode}
            disabled={!canSendCode}
            className="shrink-0"
          >
            {isSending ? "발송 중..." : isCodeSent ? "재발송" : "인증요청"}
          </Button>
        </div>

        {isCodeSent && (
          <SmsVerificationSection
            verificationCode={verificationCode}
            onChangeVerificationCode={setVerificationCode}
            timerText={timer.formattedTime}
            isExpired={timer.isExpired}
            isVerified={isVerified}
            isVerifying={isVerifying}
            canVerify={canVerify}
            onVerify={handleVerifyCode}
          />
        )}
      </div>

      <div className="pb-4 pt-6">
        <Button
          variant={isVerified ? "primary" : "secondary"}
          fullWidth
          onClick={handleSubmit}
          disabled={!isVerified}
        >
          아이디 찾기
        </Button>
      </div>
    </div>
  );
}

/* ─── 비밀번호 찾기 탭 ─── */
function FindPasswordContent({
  initialEmail,
}: {
  initialEmail: string;
}) {
  const {
    step,
    email,
    name,
    phone,
    verificationCode,
    isCodeSent,
    isVerified,
    isSending,
    isVerifying,
    isResetting,
    newPassword,
    confirmPassword,
    timer,
    canSendCode,
    canVerify,
    setEmail,
    setName,
    handlePhoneChange,
    setVerificationCode,
    setNewPassword,
    setConfirmPassword,
    handleSendCode,
    handleVerifyCode,
    handleSubmitVerification,
    handleResetPassword,
  } = useFindPassword(initialEmail);

  if (step === "reset") {
    return (
      <div className="flex flex-1 flex-col px-4">
        <div className="flex-1 space-y-[30px] pt-[30px]">
          <div className="space-y-2">
            <h2 className="text-heading-lg font-semibold text-text-primary">
              새 비밀번호 설정
            </h2>
            <p className="text-sub text-text-tertiary">
              본인인증이 완료되었습니다.
              <br />
              새로운 비밀번호를 입력해주세요.
            </p>
          </div>

          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            className="h-11"
          />

          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="h-11"
          />
        </div>

        <div className="pb-4">
          <Button
            variant="primary"
            fullWidth
            onClick={handleResetPassword}
            disabled={!newPassword || !confirmPassword || isResetting}
          >
            {isResetting ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex-1 space-y-5 pt-[30px]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="h-11"
        />

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="h-11"
        />

        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="휴대전화(-없이)"
            inputMode="numeric"
            maxLength={11}
            className="h-11 flex-1"
          />
          <Button
            variant="secondary"
            size="lg"
            onClick={handleSendCode}
            disabled={!canSendCode}
            className="shrink-0"
          >
            {isSending ? "발송 중..." : isCodeSent ? "재발송" : "인증요청"}
          </Button>
        </div>

        {isCodeSent && (
          <SmsVerificationSection
            verificationCode={verificationCode}
            onChangeVerificationCode={setVerificationCode}
            timerText={timer.formattedTime}
            isExpired={timer.isExpired}
            isVerified={isVerified}
            isVerifying={isVerifying}
            canVerify={canVerify}
            onVerify={handleVerifyCode}
          />
        )}
      </div>

      <div className="pb-4 pt-6">
        <Button
          variant={isVerified ? "primary" : "secondary"}
          fullWidth
          onClick={handleSubmitVerification}
          disabled={!isVerified}
        >
          비밀번호 찾기
        </Button>
      </div>
    </div>
  );
}

/* ─── 메인 페이지 ─── */
export default function FindAccountPage() {
  const [selectedTab, setSelectedTab] = useState<string>("findId");
  const [passwordTabEmail, setPasswordTabEmail] = useState("");
  const [findIdKey, setFindIdKey] = useState(0);
  const [findPasswordKey, setFindPasswordKey] = useState(0);

  const handleFoundEmail = useCallback((email: string) => {
    setPasswordTabEmail(email);
    setFindPasswordKey((prev) => prev + 1);
    setSelectedTab("findPassword");
  }, []);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value === selectedTab) return;
      if (value === "findId") {
        setFindIdKey((prev) => prev + 1);
        setPasswordTabEmail("");
      } else {
        setFindPasswordKey((prev) => prev + 1);
        setPasswordTabEmail("");
      }
      setSelectedTab(value);
    },
    [selectedTab],
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* 헤더 */}
      <div className="flex h-14 items-center px-4">
        <button
          onClick={() => { window.location.href = "/login"; }}
          className="flex items-center gap-1 text-sub text-text-secondary hover:text-text-primary"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          돌아가기
        </button>
      </div>

      <h1 className="px-4 text-heading-xl font-bold text-text-primary">
        계정정보 찾기
      </h1>

      {/* 탭 */}
      <Tabs.Root
        value={selectedTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <Tabs.List className="mx-4 mt-[30px] flex rounded-lg bg-gray-100 p-1">
          <Tabs.Trigger
            value="findId"
            className={cn(
              "flex-1 rounded-md py-2 text-sub font-medium transition-colors",
              selectedTab === "findId"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            아이디 찾기
          </Tabs.Trigger>
          <Tabs.Trigger
            value="findPassword"
            className={cn(
              "flex-1 rounded-md py-2 text-sub font-medium transition-colors",
              selectedTab === "findPassword"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            비밀번호 찾기
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="findId" className="flex flex-1 flex-col">
          <FindIdContent key={findIdKey} onFoundEmail={handleFoundEmail} />
        </Tabs.Content>

        <Tabs.Content value="findPassword" className="flex flex-1 flex-col">
          <FindPasswordContent
            key={findPasswordKey}
            initialEmail={passwordTabEmail}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

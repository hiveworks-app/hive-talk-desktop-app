"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountSuspendedDialog } from "@/shared/ui/AccountSuspendedDialog";
import { consumePendingSuspendedNotice, type PendingSuspendedNotice } from "@/shared/utils/pendingSuspendedNotice";
import { useLoginForm } from "@/features/auth/useLoginForm";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/Checkbox";
import { IconClearCircle, IconEyeClosed, IconEyeOpen } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/Input";
import { Spinner } from "@/shared/ui/Spinner";

export default function LoginPage() {
  const {
    email, setEmail,
    password, setPassword,
    showPassword, setShowPassword,
    isProcessing,
    loginError, setLoginError,
    passwordFocused, setPasswordFocused,
    autoLogin, setAutoLogin,
    isFormFilled,
    accessToken,
    onLogin,
    handleKeyDown,
  } = useLoginForm();

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  // 실시간 계정 정지로 강제 로그아웃된 경우, 로그인 화면 진입 시 정지 안내 1회 표시.
  // localStorage는 클라이언트 전용이라 SSR/렌더가 아닌 마운트 후 effect에서 동기화한다
  // (렌더 중 읽으면 server=null / client=notice 로 hydration 불일치 발생).
  const [pendingNotice, setPendingNotice] = useState<PendingSuspendedNotice | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라이언트 전용 1회 동기화 (hydration 불일치 방지 위해 effect 사용)
    setPendingNotice(consumePendingSuspendedNotice());
  }, []);

  if (accessToken && !isProcessing) return null;

  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <div className="flex w-full max-w-[400px] flex-col items-center px-4">
        <Image src="/hivetalk-login-logo.png" alt="HiveTalk" width={200} height={115} priority />
        <p className="mt-3 text-sub tracking-tight text-text-secondary">
          대화가 데이터가 되는곳, 똑똑한 협업 플랫폼
        </p>

        <div className="mt-12 w-full space-y-5" onKeyDown={handleKeyDown}>
          <div className="space-y-2.5">
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
              placeholder="이메일"
              autoComplete="email"
              disabled={isProcessing}
              className="h-11"
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="비밀번호"
                autoComplete="current-password"
                disabled={isProcessing}
                className={`h-11${passwordFocused && password.length > 0 ? " pr-16" : ""}`}
              />
              {passwordFocused && password.length > 0 && !isProcessing && (
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={preventBlur}
                    onClick={() => { setPassword(""); setLoginError(""); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <IconClearCircle />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={preventBlur}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <IconEyeOpen /> : <IconEyeClosed />}
                  </button>
                </div>
              )}
            </div>
            {loginError && (
              <p className="text-sub-sm text-state-error">{loginError}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAutoLogin((prev) => !prev)}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <Checkbox checked={autoLogin} size="md" />
            <span className="text-sub text-text-secondary">자동로그인</span>
          </button>

          {/* PC앱은 회원가입 미지원 — 가입은 모바일 앱에서만 진행 (로그인 버튼 단독) */}
          <Button
            variant={isFormFilled ? "primary" : "dark"}
            size="lg"
            onClick={onLogin}
            disabled={!isFormFilled || isProcessing}
            fullWidth
          >
            {isProcessing ? <Spinner /> : "로그인"}
          </Button>
        </div>

        <Link href="/find-account" className="mt-5 text-sub text-text-secondary underline">
          계정정보를 잊어버렸어요
        </Link>
      </div>

      <AccountSuspendedDialog
        open={pendingNotice !== null}
        info={pendingNotice?.info ?? null}
        onClose={() => setPendingNotice(null)}
      />
    </div>
  );
}

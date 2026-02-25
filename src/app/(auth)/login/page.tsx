"use client";

import { useState } from "react";
import { useLogin } from "@/features/auth/queries";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useUIStore } from "@/store";
import { useAuthStore } from "@/store/auth/authStore";

function getBrowserDeviceId(): string {
  const KEY = "hive-device-id";
  const stored = localStorage.getItem(KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}

export default function LoginPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const { showSnackbar } = useUIStore();
  const { mutateAsync: login, isPending } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const validateLoginInfo = (email: string, password: string) => {
    const _email = email.trim();
    const _password = password.trim();
    if (_email.length === 0) {
      setEmail("");
      return "접속하실 계정의 아이디(이메일)를 입력하세요.";
    }
    if (_password.length === 0) {
      setPassword("");
      return "접속하실 계정의 비밀번호를 입력하세요.";
    }
    if (!_email.includes("@")) {
      return "아이디가 이메일 형식이 아닙니다.";
    }
    return null;
  };

  const onLogin = async () => {
    const errorMessage = validateLoginInfo(email, password);
    if (errorMessage) {
      showSnackbar({ message: errorMessage, state: "error" });
      return;
    }

    await login({
      deviceToken: "web-no-fcm",
      deviceType: "DESKTOP",
      deviceId: getBrowserDeviceId(),
      email: email.trim(),
      password: password.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isPending) {
      onLogin();
    }
  };

  // 쿠키 없이 accessToken만 남아있으면 stale 상태 → 정리
  // (Electron 앱 데이터가 빌드 간 유지되면서 발생할 수 있음)
  if (accessToken && typeof document !== 'undefined' && !document.cookie.includes('has-auth')) {
    logout();
  }

  // 이미 로그인된 상태면 빈 화면 (middleware가 리디렉션 처리)
  if (accessToken) return null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-state-primary-highlighted">
      <div className="w-full max-w-[400px] rounded-2xl bg-surface p-8 shadow-lg">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">HIVE-TALK</h1>
          <p className="mt-1 text-sm text-text-secondary">
            일상과 업무의 분리, 대화를 통한 데이터 분석
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="아이디 입력"
            autoComplete="email"
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
          />
        </div>

        <Button
          onClick={onLogin}
          disabled={!email || !password || isPending}
          fullWidth
          className="mt-6"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </Button>

        <div className="mt-4 text-center">
          <span className="text-xs text-text-tertiary">
            계정이 없으신가요?{" "}
          </span>
          <a
            href="/signup"
            className="text-xs font-semibold text-primary hover:underline"
          >
            회원가입
          </a>
        </div>
      </div>
    </div>
  );
}

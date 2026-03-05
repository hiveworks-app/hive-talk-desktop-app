"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { useLogin } from "@/features/auth/queries";
import {
  fetchDMRoomList,
  fetchGMRoomList,
  fetchEMRoomList,
} from "@/features/chat-room-list/queries";
import { apiGetMembersList } from "@/features/members/api";
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
  EM_ROOM_LIST_KEY,
  MEMBERS_KEY,
} from "@/shared/config/queryKeys";
import { isApiError } from "@/shared/api";
import type { UserType } from "@/shared/types/user";
import { USER_TYPE } from "@/shared/types/user";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useUIStore } from "@/store";
import { useAuthStore } from "@/store/auth/authStore";
import type { LoginErrorResponse } from "@/features/auth/type";

function getBrowserDeviceId(): string {
  const KEY = "hive-device-id";
  const stored = localStorage.getItem(KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { showSnackbar } = useUIStore();
  const { mutateAsync: login } = useLogin();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const isFormFilled = email.trim().length > 0 && password.trim().length > 0;

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

    setIsProcessing(true);
    try {
      const params = {
        deviceToken: "web-no-fcm",
        deviceType: "DESKTOP" as const,
        deviceId: getBrowserDeviceId(),
        email: email.trim(),
        password: password.trim(),
      };

      const res = await login(params);

      queryClient.clear();
      await del("hiveworks-query-cache");

      const { deviceId, deviceType } = params;
      const { accessToken, refreshToken, ...rest } = res.payload;
      setAuth({
        accessToken,
        refreshToken,
        deviceInfo: { deviceId, deviceType },
        user: { ...rest, userType: USER_TYPE.ORG_MEMBER as UserType },
      });

      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: MEMBERS_KEY,
          queryFn: async () => (await apiGetMembersList()).payload.items,
        }),
        queryClient.prefetchQuery({
          queryKey: DM_ROOM_LIST_KEY,
          queryFn: fetchDMRoomList,
        }),
        queryClient.prefetchQuery({
          queryKey: GM_ROOM_LIST_KEY,
          queryFn: fetchGMRoomList,
        }),
        queryClient.prefetchQuery({
          queryKey: EM_ROOM_LIST_KEY,
          queryFn: fetchEMRoomList,
        }),
      ]);

      window.location.href = "/members";
    } catch (err) {
      setIsProcessing(false);
      if (isApiError<LoginErrorResponse>(err)) {
        const message =
          err.message ||
          "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        showSnackbar({ message, state: "error" });
        return;
      }
      if (err instanceof Error) {
        showSnackbar({ message: err.message, state: "error" });
        return;
      }
      showSnackbar({ message: "로그인 실패", state: "error" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isProcessing) {
      onLogin();
    }
  };

  if (
    accessToken &&
    typeof document !== "undefined" &&
    !document.cookie.includes("has-auth")
  ) {
    logout();
  }

  if (accessToken && !isProcessing) return null;

  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <div className="flex w-full max-w-[400px] flex-col items-center px-4">
        {/* 로고 + 서브텍스트 */}
        <Image
          src="/hivetalk-login-logo.png"
          alt="HiveTalk"
          width={200}
          height={115}
          priority
        />
        <p className="mt-3 text-sub tracking-tight text-text-secondary">
          대화가 데이터가 되는곳, 똑똑한 협업 플랫폼
        </p>

        {/* 폼 영역 */}
        <div className="mt-12 w-full space-y-5" onKeyDown={handleKeyDown}>
          {/* 입력 필드 */}
          <div className="space-y-2.5">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              autoComplete="email"
              disabled={isProcessing}
              className="h-11"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              disabled={isProcessing}
              className="h-11"
            />
          </div>

          {/* 버튼 영역 */}
          <div className="space-y-2.5">
            <Button
              variant={isFormFilled ? "primary" : "dark"}
              size="lg"
              onClick={onLogin}
              disabled={!isFormFilled || isProcessing}
              fullWidth
            >
              {isProcessing ? <Spinner /> : "로그인"}
            </Button>
            <Button
              variant="primary-light"
              size="lg"
              onClick={() => { window.location.href = "/signup"; }}
              fullWidth
            >
              회원가입
            </Button>
          </div>
        </div>

        {/* 계정정보 찾기 링크 */}
        <Link
          href="/find-account"
          className="mt-5 text-sub text-text-secondary underline"
        >
          계정정보를 잊어버렸어요
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { useLogin } from "@/features/auth/queries";
import { fetchDMRoomList, fetchGMRoomList, fetchEMRoomList } from "@/features/chat-room-list/queries";
import { apiGetMembersList } from "@/features/members/api";
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, MEMBERS_KEY } from "@/shared/config/queryKeys";
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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

      // 1. 로그인 API 호출
      const res = await login(params);

      // 2. 이전 유저 캐시 완전 제거
      queryClient.clear();
      await del("hiveworks-query-cache");

      // 3. 새 유저 인증 설정
      const { deviceId, deviceType } = params;
      const { accessToken, refreshToken, ...rest } = res.payload;
      setAuth({
        accessToken,
        refreshToken,
        deviceInfo: { deviceId, deviceType },
        user: { ...rest, userType: USER_TYPE.ORG_MEMBER as UserType },
      });

      // 4. 핵심 데이터 prefetch (스피너가 도는 동안 완료 대기)
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: MEMBERS_KEY,
          queryFn: async () => (await apiGetMembersList()).payload.items,
        }),
        queryClient.prefetchQuery({ queryKey: DM_ROOM_LIST_KEY, queryFn: fetchDMRoomList }),
        queryClient.prefetchQuery({ queryKey: GM_ROOM_LIST_KEY, queryFn: fetchGMRoomList }),
        queryClient.prefetchQuery({ queryKey: EM_ROOM_LIST_KEY, queryFn: fetchEMRoomList }),
      ]);

      // 5. 모든 데이터 준비 완료 → 화면 전환
      router.replace("/members");
    } catch (err) {
      if (isApiError<LoginErrorResponse>(err)) {
        const message = err.message || "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        showSnackbar({ message, state: "error" });
        return;
      }
      if (err instanceof Error) {
        showSnackbar({ message: err.message, state: "error" });
        return;
      }
      showSnackbar({ message: "로그인 실패", state: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isProcessing) {
      onLogin();
    }
  };

  // 쿠키 없이 accessToken만 남아있으면 stale 상태 → 정리
  if (accessToken && typeof document !== 'undefined' && !document.cookie.includes('has-auth')) {
    logout();
  }

  // 이미 로그인된 상태면 빈 화면 (middleware가 리디렉션 처리)
  // isProcessing 중에는 로그인 폼+스피너를 계속 보여줌 (흰 화면 방지)
  if (accessToken && !isProcessing) return null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white">
      <div className="w-full max-w-[400px] rounded-2xl bg-surface p-8 shadow-lg">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <h1 className="text-heading-xl font-bold text-primary">HIVE-TALK</h1>
          <p className="mt-1 text-sub text-text-secondary">
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
            disabled={isProcessing}
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            disabled={isProcessing}
          />
        </div>

        <Button
          onClick={onLogin}
          disabled={!email || !password || isProcessing}
          fullWidth
          className="mt-6"
        >
          {isProcessing ? <Spinner /> : "로그인"}
        </Button>

        <div className="mt-4 text-center">
          <span className="text-sub-sm text-text-tertiary">
            계정이 없으신가요?{" "}
          </span>
          <a
            href="/signup"
            className="text-sub-sm font-semibold text-primary hover:underline"
          >
            회원가입
          </a>
        </div>
      </div>
    </div>
  );
}

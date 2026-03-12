"use client";

import { useSyncExternalStore, useState } from "react";
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
import { apiGetStorage } from "@/features/storage/api";
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
  EM_ROOM_LIST_KEY,
  MEMBERS_KEY,
  PRESIGNED_URL,
} from "@/shared/config/queryKeys";
import type { MemberItem } from "@/shared/types/user";
import type { UserType } from "@/shared/types/user";
import { USER_TYPE } from "@/shared/types/user";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/Checkbox";
import { Input } from "@/shared/ui/Input";
import { Spinner } from "@/shared/ui/Spinner";
import { getBrowserDeviceId } from "@/shared/utils/deviceId";
import { useAuthStore } from "@/store/auth/authStore";

export default function LoginPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { mutateAsync: login } = useLogin();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const autoLoginStored = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => localStorage.getItem("auto-login") === "true",
    () => false, // 서버 스냅샷: false (Hydration 불일치 방지)
  );
  const [autoLogin, setAutoLogin] = useState(autoLoginStored);

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

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
      setLoginError(errorMessage);
      return;
    }

    setIsProcessing(true);
    try {
      const deviceId = getBrowserDeviceId();
      const params = {
        deviceToken: deviceId,
        deviceType: "DESKTOP" as const,
        deviceId,
        email: email.trim(),
        password: password.trim(),
      };

      const res = await login(params);

      localStorage.setItem("auto-login", String(autoLogin));
      queryClient.clear();
      await del("hiveworks-query-cache");

      const { accessToken, refreshToken, ...rest } = res.payload;
      setAuth({
        accessToken,
        refreshToken,
        deviceInfo: { deviceId, deviceType: params.deviceType },
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

      // 멤버 프로필 이미지 presigned URL 미리 로드
      const members = queryClient.getQueryData<MemberItem[]>(MEMBERS_KEY);
      if (members) {
        const profileKeys = [
          ...new Set(
            members
              .map((m) => m.profileUrl)
              .filter((key): key is string => !!key),
          ),
        ];
        await Promise.allSettled(
          profileKeys.map((key) =>
            queryClient.prefetchQuery({
              queryKey: PRESIGNED_URL(key),
              queryFn: async () => (await apiGetStorage(key)).payload.key,
              staleTime: 10 * 60 * 1000,
            }),
          ),
        );
      }

      window.location.href = "/members";
    } catch {
      setIsProcessing(false);
      setLoginError("하이브톡계정 또는 비밀번호를 다시 입력해주세요.");
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
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginError("");
              }}
              placeholder="이메일"
              autoComplete="email"
              disabled={isProcessing}
              className="h-11"
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError("");
                }}
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={preventBlur}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
            {loginError && (
              <p className="text-sub-sm text-state-error">{loginError}</p>
            )}
          </div>

          {/* 자동로그인 */}
          <button
            type="button"
            onClick={() => setAutoLogin((prev) => !prev)}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <Checkbox checked={autoLogin} size="md" />
            <span className="text-sub text-text-secondary">자동로그인</span>
          </button>

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
              onClick={() => {
                window.location.href = "/signup";
              }}
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

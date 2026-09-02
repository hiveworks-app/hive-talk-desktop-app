import { del } from "idb-keyval";
import { useAuthStore } from "@/store/auth/authStore";
import { DUPLICATE_LOGIN_CODE, useSessionDisconnectStore } from "@/store/auth/sessionDisconnectStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/** auth store에 deviceInfo가 없을 때 로그인 시 생성한 localStorage 값으로 fallback */
function getFallbackDeviceInfo() {
  if (typeof window === "undefined") return null;
  const deviceId = localStorage.getItem("hive-device-id");
  if (!deviceId) return null;
  return { deviceId, deviceType: "DESKTOP" as const };
}

/**
 * refresh 요청용 fetch
 * RN 앱과 동일하게 auth store의 deviceInfo를 사용하여 deviceId 일관성 보장
 */
export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, user, deviceInfo, setAuth } = useAuthStore.getState();

  if (!refreshToken || !user) {
    return null;
  }

  const effectiveDeviceInfo = deviceInfo ?? getFallbackDeviceInfo();
  if (!effectiveDeviceInfo) {
    return null;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const body = {
        deviceType: effectiveDeviceInfo.deviceType,
        deviceId: effectiveDeviceInfo.deviceId,
        userId: user.id,
        refreshToken,
        deviceToken: effectiveDeviceInfo.deviceId,
      };

      const res = await fetch(`${BASE_URL}/app/refresh-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // 타임아웃 — refresh 영구 대기 시 후속 요청 전체가 잠기는 것 방지 (RN fetchWithTimeout 패리티)
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        // 중복 로그인(SC010) 거절 — 강제 로그아웃 대신 안내 다이얼로그 확인 대기 (RN 패리티)
        let rejectCode: string | undefined;
        try {
          rejectCode = ((await res.json()) as { code?: string } | null)?.code;
        } catch {
          /* 파싱 실패 시 일반 실패 경로 */
        }
        const { noticeVisible, showNotice } = useSessionDisconnectStore.getState();
        if (rejectCode === DUPLICATE_LOGIN_CODE || noticeVisible) {
          if (rejectCode === DUPLICATE_LOGIN_CODE) showNotice();
          console.warn('📜 RefreshToken 거절 — 중복 로그인 안내 대기', res.status, rejectCode);
          return null;
        }
        // 거절 경로 세션 fence (RN commit gate 패리티) — 로그아웃→재로그인이 겹친 뒤 늦게
        // 도착한 이전 세션의 401이 방금 만든 새 세션을 죽이는 것 방지. 이 flight를 시작한
        // refreshToken이 더 이상 현재 세션 것이 아니면 조용히 폐기한다.
        const rejected = useAuthStore.getState();
        if (rejected.refreshToken !== refreshToken) {
          console.warn('📜 Refresh 거절 stale 응답 폐기 — 세션이 이미 교체됨');
          return null;
        }
        handleForceLogout();
        return null;
      }

      const data = await res.json();

      // 세션 fence — 로그아웃/세션 교체 후 늦게 도착한 stale 응답이 인증을 되살리는 것 차단 (RN PR-1b 패리티)
      const current = useAuthStore.getState();
      if (!current.accessToken || current.refreshToken !== refreshToken) {
        console.warn('📜 Refresh stale 응답 폐기 — 세션이 이미 교체/종료됨');
        return null;
      }

      setAuth({
        accessToken: data.payload.accessToken,
        refreshToken: data.payload.refreshToken,
      });

      return data.payload.accessToken as string;
    } catch {
      // 네트워크 레벨 실패(오프라인·타임아웃·DNS 등)는 로그아웃 금지 — 일시 장애에 세션을 버리지
      // 않는다. 서버의 명시적 거절은 위 !res.ok 분기가 처리한다 (RN PR-1b "network 오류 로그아웃 금지")
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function handleForceLogout() {
  // 서버 디바이스 세션 종료 best-effort — 로컬만 지우면 서버에 세션이 잔존한다 (RN 패리티).
  // 이미 토큰이 무효한 상황일 수 있으므로 실패는 무시(fire-and-forget).
  const token = useAuthStore.getState().accessToken;
  if (token) {
    void fetch(`${process.env.NEXT_PUBLIC_API_URL}/app/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  useAuthStore.getState().logout();
  del("hiveworks-query-cache");           // IndexedDB 영속 캐시 삭제
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

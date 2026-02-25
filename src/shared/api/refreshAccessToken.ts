import { useAuthStore } from "@/store/auth/authStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * refresh 요청용 fetch
 * RN 앱과 동일하게 auth store의 deviceInfo를 사용하여 deviceId 일관성 보장
 */
export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, user, deviceInfo, setAuth } = useAuthStore.getState();

  if (!refreshToken || !user || !deviceInfo) {
    return null;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const body = {
        deviceType: deviceInfo.deviceType,
        deviceId: deviceInfo.deviceId,
        userId: user.id,
        refreshToken,
        deviceToken: "web-no-fcm",
      };

      const res = await fetch(`${BASE_URL}/app/refresh-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        handleForceLogout();
        return null;
      }

      const data = await res.json();

      setAuth({
        accessToken: data.payload.accessToken,
        refreshToken: data.payload.refreshToken,
      });

      return data.payload.accessToken as string;
    } catch {
      handleForceLogout();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function handleForceLogout() {
  useAuthStore.getState().logout();
  document.cookie = "has-auth=; max-age=0; path=/";
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

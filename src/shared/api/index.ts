import { AuthError } from '@/shared/api/errors';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { isEffectivelyOffline } from '@/store/networkStatusStore';
import { normalizeEndpoint, useSystemErrorStore } from '@/store/systemErrorStore';
import { useAuthStore } from '@/store/auth/authStore';
import { DUPLICATE_LOGIN_CODE, useSessionDisconnectStore } from '@/store/auth/sessionDisconnectStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiResponse<TPayload> {
  success: boolean;
  code: string;
  message?: string;
  payload: TPayload;
}

export class ApiError<TPayload = unknown> extends Error {
  status: number;
  code?: string;
  payload?: TPayload | null;
  rawBody?: string;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    payload?: TPayload | null;
    rawBody?: string;
  }) {
    super(params.message);
    this.status = params.status;
    this.code = params.code;
    this.payload = params.payload;
    this.rawBody = params.rawBody;
  }
}

export function isApiError<TPayload = unknown>(err: unknown): err is ApiError<TPayload> {
  return err instanceof ApiError;
}

/** API 에러면 서버 메시지, 아니면 fallback 메시지를 반환 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return isApiError(err) ? (err.message || fallback) : fallback;
}

// API 타임아웃 — 응답 없는 서버/프록시에서 요청이 영구 대기(pending)로 남아
// 로딩 스피너 고착·mutation 미완료가 발생하는 것을 방지 (RN fetchWithTimeout 패리티)
const REQUEST_TIMEOUT_MS = 30_000; // RN 패리티 — 저속 회선에서 조기 포기 방지
const UPLOAD_TIMEOUT_MS = 120_000;

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

/** 타임아웃(TimeoutError)을 사용자 친화 ApiError로 정규화 */
function normalizeTimeoutError(err: unknown): never {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    throw new ApiError({ status: 0, message: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' });
  }
  throw err;
}

async function rawRequest(path: string, options: RequestOptions = {}) {
  const { method = 'GET', body, headers = {}, signal } = options;

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: withTimeout(signal, REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // 온라인인데 서버 도달 불가 — 시스템 오류 증거 (오프라인 의심 중엔 미보고, RN phase 게이트)
    if (!isEffectivelyOffline()) {
      useSystemErrorStore.getState().report(normalizeEndpoint(path));
    }
    normalizeTimeoutError(err);
  }
}

export async function request<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<TResponse>> {
  const { method = 'GET', body, headers = {}, signal } = options;

  // 확정 오프라인만 차단 (RN 패리티 — verifying 구간엔 시도 허용, 실패는 네트워크 에러로 처리)
  if (method !== 'GET' && isEffectivelyOffline()) {
    throw new ApiError({ status: 0, message: '오프라인 상태에서는 사용할 수 없습니다.' });
  }

  const { accessToken } = useAuthStore.getState();

  const authHeaders =
    accessToken != null
      ? { ...headers, Authorization: `${accessToken}` }
      : headers;

  const res = await rawRequest(path, { method, body, headers: authHeaders, signal });

  // accessToken 만료 → refresh 시도
  if (res.status === 401 && path !== '/app/login') {
    let rawText = '';
    let parsed: ApiResponse<unknown> | null = null;

    try {
      rawText = await res.text();
      parsed = rawText ? (JSON.parse(rawText) as ApiResponse<unknown>) : null;
    } catch {
      // JSON 파싱 실패
    }

    const serverCode = parsed?.code;
    const serverMessage = parsed?.message;

    // 중복 로그인(SC010) — 백그라운드 복귀 등으로 소켓 메시지를 못 받은 경우의 REST 감지 경로.
    // 강제 종료 안내 다이얼로그를 띄우고, 로그아웃은 확인 시점에 수행 (RN 패리티)
    if (serverCode === DUPLICATE_LOGIN_CODE) {
      useSessionDisconnectStore.getState().showNotice();
      throw new AuthError(
        serverMessage || '다른 기기에서 로그인되어 로그아웃되었습니다.',
        'TOKEN_EXPIRED',
      );
    }

    const RETRYABLE_ERROR_CODES = ['SC001', 'SC002'];
    const canRetryWithRefresh = !!serverCode && RETRYABLE_ERROR_CODES.includes(serverCode);

    if (!canRetryWithRefresh) {
      throw new AuthError(
        serverMessage || rawText || res.statusText || '인증이 만료되었습니다.',
        'TOKEN_EXPIRED',
      );
    }

    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new AuthError('인증이 만료되었습니다.', 'TOKEN_EXPIRED');
    }

    const retryRes = await rawRequest(path, {
      method,
      body,
      headers: { ...headers, Authorization: `${newToken}` },
      signal,
    });

    if (!retryRes.ok) {
      throw await buildApiErrorFromResponse(retryRes);
    }

    const retryText = await retryRes.text();
    if (!retryText) {
      throw new ApiError({ status: retryRes.status, message: 'Empty response body on retry', rawBody: '' });
    }

    return JSON.parse(retryText) as ApiResponse<TResponse>;
  }

  if (!res.ok) {
    throw await buildApiErrorFromResponse(res);
  }

  const text = await res.text();
  if (!text) {
    throw new ApiError({ status: res.status, message: 'Empty response body', rawBody: '' });
  }

  return JSON.parse(text) as ApiResponse<TResponse>;
}

/**
 * 인증 토큰 없이 요청 (/public/* 경로용)
 */
export async function publicRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<TResponse>> {
  const { method = 'GET' } = options;

  if (method !== 'GET' && typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError({ status: 0, message: '오프라인 상태에서는 사용할 수 없습니다.' });
  }

  const res = await rawRequest(path, options);

  if (!res.ok) {
    throw await buildApiErrorFromResponse(res);
  }

  const text = await res.text();
  if (!text) {
    return { success: true, code: '200', payload: null as TResponse };
  }

  return JSON.parse(text) as ApiResponse<TResponse>;
}

export async function uploadToPresignedUrl(
  url: string,
  fileBody: Blob | ArrayBuffer,
  contentType: string,
) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('오프라인 상태에서는 사용할 수 없습니다.');
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileBody,
    // 업로드는 대용량 대비 여유 타임아웃 — 무한 pending만 방지
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`S3 Upload Error (${res.status}): ${text || res.statusText}`);
  }
}

async function buildApiErrorFromResponse(res: Response): Promise<ApiError<ApiResponse<unknown>>> {
  let raw = '';
  let parsed: ApiResponse<unknown> | null = null;

  try {
    raw = await res.text();
    parsed = raw ? (JSON.parse(raw) as ApiResponse<unknown>) : null;
  } catch {
    // JSON 파싱 실패
  }

  // 사용자 노출 메시지 정책 (RN 패리티):
  // - JSON 응답의 message만 노출 후보로 인정 — 프록시(Cloudflare/Nginx)의 HTML 에러 페이지
  //   원문이 스낵바에 그대로 뜨는 것을 차단한다 (raw 폴백 금지)
  // - 5xx는 서버 내부 메시지를 버리고 일반 안내로 통일
  // 5xx는 무조건 시스템 오류 증거 — 여러 endpoint에 걸쳐 반복되면 전역 배너 (RN reportIfSystemError)
  if (res.status >= 500) {
    try {
      useSystemErrorStore.getState().report(normalizeEndpoint(new URL(res.url).pathname));
    } catch {
      // URL 파싱 실패 무시
    }
  }

  const isJsonBody = (res.headers.get('content-type') ?? '').includes('application/json');
  const safeMessage =
    res.status >= 500
      ? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      : (isJsonBody ? parsed?.message : undefined) || res.statusText || '요청 처리 중 오류가 발생했습니다.';

  return new ApiError<ApiResponse<unknown>>({
    status: res.status,
    code: parsed?.code,
    message: safeMessage,
    payload: parsed ?? null,
    rawBody: raw,
  });
}

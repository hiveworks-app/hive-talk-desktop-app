import { AuthError } from '@/shared/api/errors';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import { useAuthStore } from '@/store/auth/authStore';

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

async function rawRequest(path: string, options: RequestOptions = {}) {
  const { method = 'GET', body, headers = {}, signal } = options;

  return await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
}

export async function request<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<TResponse>> {
  const { method = 'GET', body, headers = {}, signal } = options;

  if (method !== 'GET' && typeof navigator !== 'undefined' && !navigator.onLine) {
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

  return new ApiError<ApiResponse<unknown>>({
    status: res.status,
    code: parsed?.code,
    message: parsed?.message || raw || res.statusText || '요청 처리 중 오류가 발생했습니다.',
    payload: parsed ?? null,
    rawBody: raw,
  });
}

import type { ErrorEvent } from '@sentry/electron/main';

// 채팅앱이라 토큰/채팅본문/이메일/전화번호 등이 에러 컨텍스트에 섞일 수 있어
// Sentry 전송 직전 민감정보를 제거한다. (모바일 initSentry.ts와 동일 정책)

const TOKEN_LIKE_KEY = /(authorization|token|password|secret|refresh)/i;

// 패턴으로 못 잡는 도메인 필드(채팅 본문, 연락처, 서버 에러 응답 등)는 키 이름으로 값을 통째 제거.
// payload/rawBody: ApiError가 서버 에러 응답 본문을 담는 필드.
const DOMAIN_SENSITIVE_KEY =
  /(content|text|nickname|email|phone(number)?|username|roomname|payload|rawbody|participants|participantdetail)$/i;

const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const KR_PHONE_PATTERN = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g;

const MAX_SCRUB_DEPTH = 8;

function maskString(value: string): string {
  return value
    .replace(JWT_PATTERN, '[jwt]')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(KR_PHONE_PATTERN, '[phone]');
}

function isSensitiveKey(key: string): boolean {
  return TOKEN_LIKE_KEY.test(key) || DOMAIN_SENSITIVE_KEY.test(key);
}

/**
 * 데이터 영역(extra/contexts/request/breadcrumb.data)을 재귀 순회하며
 * 민감 키는 값을 통째로 redact, 그 외 문자열에는 패턴 마스킹을 적용한다.
 */
function scrubInPlace(node: unknown, depth = 0, seen = new WeakSet<object>()): void {
  if (node === null || typeof node !== 'object') return;
  if (depth > MAX_SCRUB_DEPTH || seen.has(node)) return;
  seen.add(node);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const item: unknown = node[i];
      if (typeof item === 'string') node[i] = maskString(item);
      else scrubInPlace(item, depth + 1, seen);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (isSensitiveKey(key)) {
      Reflect.set(node, key, '[redacted]');
    } else if (typeof value === 'string') {
      Reflect.set(node, key, maskString(value));
    } else {
      scrubInPlace(value, depth + 1, seen);
    }
  }
}

/**
 * Sentry 전송 직전 민감정보 제거.
 * 1) 키 기반 redact — 도메인 필드(채팅 본문 등)를 키 이름으로 통째 제거 (데이터 영역만)
 * 2) 값 기반 패턴 마스킹 — 이메일/휴대폰/JWT를 모든 문자열에서 치환
 */
export function scrubSensitiveData(event: ErrorEvent): ErrorEvent | null {
  if (event.message) {
    event.message = maskString(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = maskString(exception.value);
    }
  }

  scrubInPlace(event.extra);
  scrubInPlace(event.contexts);
  scrubInPlace(event.request);
  scrubInPlace(event.user);
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) {
      breadcrumb.message = maskString(breadcrumb.message);
    }
    scrubInPlace(breadcrumb.data);
  }

  return event;
}

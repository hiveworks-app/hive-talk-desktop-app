import * as Sentry from '@sentry/electron/renderer';
import { scrubSensitiveData } from './scrub';

let initialized = false;

/**
 * 렌더러(Next 클라이언트) Sentry 초기화.
 * - DSN(NEXT_PUBLIC_SENTRY_DSN) 미설정 시 no-op (모바일과 동일 정책).
 * - dsn을 직접 넘기지 않고 메인 프로세스로 IPC 포워딩 → 메인이 최종 전송/스크럽.
 * - captureConsoleIntegration: 기존 console.error를 그대로 이벤트로 흡수.
 *   (warn은 한도 절약 위해 제외, breadcrumb으로만 남김 — 모바일 POC와 동일)
 */
export function initRendererSentry(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  initialized = true;
  Sentry.init({
    environment: process.env.NODE_ENV ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
    beforeSend: scrubSensitiveData,
  });
}

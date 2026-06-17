import * as Sentry from '@sentry/electron/main';
import { scrubSensitiveData } from './sentryScrub';

/**
 * Electron 메인 프로세스 Sentry 초기화.
 * - 렌더러에서 IPC로 포워딩된 이벤트의 최종 beforeSend(스크럽) 게이트.
 * - DSN 미설정 시 no-op (안전). Sentry DSN은 공개 가능하므로 프로덕션에선
 *   빌드 시 SENTRY_DSN 주입 또는 아래 상수에 직접 기입해도 된다.
 */
export function initMainSentry(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn) {
    console.log('[Sentry] DSN 미설정 → 에러 수집 비활성(no-op)');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    sendDefaultPii: false,
    // 에러 수집이 주목적 — 성능 트레이싱 비활성(span 한도 보존)
    tracesSampleRate: 0,
    beforeSend: scrubSensitiveData,
  });
}

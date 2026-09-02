import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { scrubSensitiveData } from './sentryScrub';

/**
 * Electron 메인 프로세스 Sentry 초기화.
 * - 렌더러에서 IPC로 포워딩된 이벤트의 최종 beforeSend(스크럽) 게이트.
 * - DSN 미설정 시 no-op (안전). Sentry DSN은 공개 가능하므로 프로덕션에선
 *   빌드 시 SENTRY_DSN 주입 또는 아래 상수에 직접 기입해도 된다.
 */
// 데스크톱 전용 Sentry 프로젝트 DSN (2026-09-02, RN 프로젝트와 분리) — 공개 가능 값.
// 패키지 앱은 런타임 환경변수가 없으므로 상수가 기본값이고, 렌더러 이벤트도 IPC로
// 이 프로세스에 모여 이 DSN으로 전송된다. dev(비패키지)는 명시 환경변수로만 활성.
const PROD_DSN =
  'https://d83ae87d0b96f18b7d9772c47318d0f3@o4511505666408448.ingest.us.sentry.io/4512014417002496';

export function initMainSentry(): void {
  const dsn =
    process.env.SENTRY_DSN ??
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    (app.isPackaged ? PROD_DSN : '');
  if (!dsn) {
    console.log('[Sentry] DSN 미설정 → 에러 수집 비활성(no-op)');
    return;
  }

  Sentry.init({
    dsn,
    environment: app.isPackaged ? 'production' : 'development',
    // 버전별 이슈 구분 — "어느 버전에서 터졌나"가 원격 진단의 첫 질문
    release: `hivetalk-desktop@${app.getVersion()}`,
    sendDefaultPii: false,
    // 에러 수집이 주목적 — 성능 트레이싱 비활성(span 한도 보존)
    tracesSampleRate: 0,
    beforeSend: scrubSensitiveData,
  });
}

/** 기동 지연 리포트 — 실행→창 표시가 임계를 넘긴 머신을 원격에서 식별 (백신/디스크 문제 PC 진단용).
 *  Sentry 미초기화(dev 등)면 captureMessage는 안전한 no-op이다. */
export function reportSlowStartup(elapsedMs: number): void {
  Sentry.captureMessage(`slow-startup: ${Math.round(elapsedMs / 1000)}s`, {
    level: 'warning',
    extra: { elapsedMs, platform: process.platform },
  });
}

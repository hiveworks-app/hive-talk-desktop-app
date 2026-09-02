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
// 데스크톱 전용 Sentry 프로젝트 DSN (2026-09-02, RN 프로젝트와 분리) — DSN은 수집 주소일 뿐
// 비밀키가 아니라 공개 가능(배포 바이너리에 어차피 내장). 프로덕션 빌드에만 기본 적용하고,
// dev는 환경변수로 명시할 때만 활성화해 개발 소음이 대시보드를 오염시키지 않게 한다.
const PROD_DSN =
  'https://d83ae87d0b96f18b7d9772c47318d0f3@o4511505666408448.ingest.us.sentry.io/4512014417002496';

export function initRendererSentry(): void {
  if (initialized) return;
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    (process.env.NODE_ENV === 'production' ? PROD_DSN : undefined);
  if (!dsn) return;

  initialized = true;
  Sentry.init({
    environment: process.env.NODE_ENV ?? 'production',
    // 버전별 이슈 구분 — "어느 버전에서 터졌나"가 원격 진단의 첫 질문 (next.config env 주입값)
    release: process.env.NEXT_PUBLIC_APP_VERSION
      ? `hivetalk-desktop@${process.env.NEXT_PUBLIC_APP_VERSION}`
      : undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
    beforeSend: scrubSensitiveData,
  });
}

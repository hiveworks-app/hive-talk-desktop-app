import * as Sentry from '@sentry/electron/renderer';

type LogContext = Record<string, unknown>;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * 앱 공용 로거. (모바일 logger.ts와 동일 컨벤션)
 * - DSN 미설정/개발 환경에서는 Sentry 호출이 자동 no-op이라 안전.
 * - error/warn은 prod에서 console을 거치지 않는다(captureConsoleIntegration과의 이중 수집 방지).
 *   개발 가시성을 위해 isDev에서만 콘솔 출력.
 */
export const logger = {
  /** 디버깅 흐름 기록. 이벤트로 전송되지 않고 다음 에러의 breadcrumb로만 남는다. */
  breadcrumb(message: string, data?: LogContext): void {
    Sentry.addBreadcrumb({ message, data, level: 'info' });
  },

  info(message: string, context?: LogContext): void {
    if (isDev) console.log(message, context ?? '');
    Sentry.addBreadcrumb({ message, data: context, level: 'info' });
  },

  warn(message: string, context?: LogContext): void {
    if (isDev) console.warn(message, context ?? '');
    Sentry.addBreadcrumb({ message, data: context, level: 'warning' });
  },

  /** error는 Error 인스턴스를 넘기면 스택까지 수집된다. */
  error(error: unknown, context?: LogContext): void {
    if (isDev) console.error(error, context ?? '');
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: context });
    } else {
      Sentry.captureMessage(String(error), { level: 'error', extra: context });
    }
  },
};

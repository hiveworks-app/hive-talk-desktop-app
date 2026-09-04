import { useCallback, useEffect, useRef, useState } from 'react';

const TIMER_DURATION = 300;

const remainingSecondsUntil = (expiresAt: number | null) =>
  expiresAt == null ? 0 : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

/**
 * SMS 인증 카운트다운 타이머 훅 (RN 패리티 — wall-clock 기준).
 * `prev - 1` 틱 누적은 창 최소화/백그라운드 스로틀링에서 실제보다 늦게 만료돼
 * 서버 5분 만료와 어긋난다 — 절대 만료 시각 기준으로 매 틱 재계산하고,
 * 창 복귀(visibility/focus) 시 즉시 재동기화한다.
 */
export const useCountdownTimer = (duration = TIMER_DURATION) => {
  const [seconds, setSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const expiresAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = seconds > 0;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 절대 만료 시각 기준으로 남은 초를 현재 시점에 맞춰 재계산한다.
  const syncFromClock = useCallback(() => {
    const next = remainingSecondsUntil(expiresAtRef.current);
    setSeconds(next);
    if (next <= 0) {
      expiresAtRef.current = null;
      clear();
    }
  }, [clear]);

  useEffect(() => {
    if (!isRunning) {
      clear();
      return;
    }
    timerRef.current = setInterval(syncFromClock, 1000);
    return clear;
  }, [isRunning, syncFromClock, clear]);

  // 백그라운드 → 복귀 시 즉시 재동기화 (스로틀된 틱 보정 — RN AppState 대응)
  useEffect(() => {
    const onVisible = () => {
      if (expiresAtRef.current != null) syncFromClock();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [syncFromClock]);

  const start = useCallback(() => {
    setHasStarted(true);
    expiresAtRef.current = Date.now() + duration * 1000;
    setSeconds(duration);
  }, [duration]);

  // 서버가 정한 절대 만료 시각으로 시작 — 딥링크 진입 시 메일 발송 시점 기준의 실제
  // 잔여 시간을 표시한다 (RN startTimerWithExpiresAt 패리티)
  const startWithExpiresAt = useCallback((expiresAtMs: number) => {
    setHasStarted(true);
    expiresAtRef.current = expiresAtMs;
    setSeconds(remainingSecondsUntil(expiresAtMs));
  }, []);

  const stop = useCallback(() => {
    expiresAtRef.current = null;
    setSeconds(0);
    clear();
  }, [clear]);

  const formattedTime =
    seconds > 0
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : hasStarted
        ? '0:00'
        : '';

  return {
    seconds,
    formattedTime,
    isExpired: hasStarted && seconds === 0,
    isRunning,
    start,
    startWithExpiresAt,
    stop,
  } as const;
};

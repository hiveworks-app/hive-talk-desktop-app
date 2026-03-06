import { useCallback, useEffect, useRef, useState } from 'react';

const TIMER_DURATION = 300;

/**
 * SMS 인증 카운트다운 타이머 훅
 * - 3분(180초) 카운트다운
 * - 포맷된 타이머 텍스트 제공 (예: "2:45")
 * - start()로 타이머 시작/재시작
 */
export const useCountdownTimer = (duration = TIMER_DURATION) => {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = seconds > 0;

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const [hasStarted, setHasStarted] = useState(false);

  const start = useCallback(() => {
    setHasStarted(true);
    setSeconds(duration);
  }, [duration]);

  const stop = useCallback(() => {
    setSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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
    stop,
  } as const;
};

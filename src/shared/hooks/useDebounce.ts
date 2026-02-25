import { useCallback, useEffect, useRef } from 'react';

/**
 * useDebounce Hook
 * @description 디바운스 기능을 제공하는 커스텀 훅
 *
 * @example
 * ```tsx
 * const debouncedSearch = useDebounce((text: string) => {
 *   console.info('Search:', text);
 * }, 500);
 *
 * <input onChange={e => debouncedSearch(e.target.value)} />
 * ```
 */
export function useDebounce<T extends (...args: never[]) => void>(
  callback: T,
  delay: number = 300,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [callback, delay],
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

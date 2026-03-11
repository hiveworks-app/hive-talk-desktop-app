/**
 * 배열을 size 단위로 쪼개는 유틸
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

/**
 * 동시성 제한 병렬 실행기
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onDone?: (done: number, total: number) => void,
): Promise<R[]> {
  const total = items.length;
  const results: R[] = new Array(total);
  let nextIndex = 0;
  let done = 0;

  const runners = Array.from({ length: Math.min(limit, total) }, async () => {
    while (true) {
      const current = nextIndex;
      if (current >= total) break;
      nextIndex += 1;
      results[current] = await worker(items[current]);
      done += 1;
      onDone?.(done, total);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * 250ms 스로틀러 (업로드 진행률 UI 부하 방지)
 */
export function makeProgressThrottler() {
  let lastAt = 0;
  let pending: { done: number; total: number } | null = null;
  let raf: number | null = null;

  return (next: { done: number; total: number }, commit: (p: typeof next) => void) => {
    pending = next;
    const now = Date.now();
    if (now - lastAt > 250) {
      lastAt = now;
      commit(pending);
      pending = null;
      return;
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (!pending) return;
      lastAt = Date.now();
      commit(pending);
      pending = null;
    });
  };
}

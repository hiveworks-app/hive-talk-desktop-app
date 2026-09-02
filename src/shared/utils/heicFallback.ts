'use client';

/**
 * HEIC 폴백 (2026-09-02) — <img> 로드 실패 시 메인 프로세스에 변환을 요청한다.
 *
 * RN 업로드 구멍(작은 파일 포맷 변환 생략)으로 서버에 남은 HEIC 원본은 Chromium이
 * 디코드하지 못한다. 실패한 URL을 IPC로 넘기면 메인이 HEIC 판정 후 JPEG data URL로
 * 돌려준다. 판정 결과는 캐시해 같은 이미지에 IPC를 반복하지 않는다.
 * - 'not-heic' 확정 → 부정 캐시 (만료 등 다른 실패 원인은 기존 재발급 경로가 처리)
 * - 'fetch-failed'(만료 403 등) → 캐시하지 않음: fresh URL로 재시도 여지를 남긴다
 */

interface HeicApi {
  convertHeicImage?: (url: string) => Promise<
    { status: 'converted'; dataUrl: string } | { status: 'not-heic' } | { status: 'fetch-failed' }
  >;
}

const convertedCache = new Map<string, string>();
const notHeicCache = new Set<string>();

export async function tryHeicFallback(cacheKey: string, url: string): Promise<string | null> {
  const cached = convertedCache.get(cacheKey);
  if (cached) return cached;
  if (notHeicCache.has(cacheKey)) return null;

  const api = (window as unknown as { electronAPI?: HeicApi }).electronAPI;
  if (!api?.convertHeicImage) return null; // 브라우저 dev — 폴백 없음

  try {
    const res = await api.convertHeicImage(url);
    if (res.status === 'converted') {
      convertedCache.set(cacheKey, res.dataUrl);
      return res.dataUrl;
    }
    if (res.status === 'not-heic') notHeicCache.add(cacheKey);
    return null;
  } catch {
    return null;
  }
}

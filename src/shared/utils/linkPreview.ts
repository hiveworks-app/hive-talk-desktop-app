/**
 * 링크 프리뷰 공용 유틸 (클라이언트·서버 양쪽 안전 — RN 의존성 없음).
 * OG 메타 fetch/파싱은 서버 route(`app/api/og-preview`)에서, 카드 표시는 클라이언트에서 사용.
 * RN `shared/ui/Chats/parseTextWithLinks.ts` + `ogParser.ts`의 순수 헬퍼 미러.
 */

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  domain?: string;
  thumbnailUrl?: string;
}

/** URL 매칭 정규식 — http(s)://, www., 또는 도메인.확장자 패턴 (RN parseTextWithLinks 미러) */
export const URL_REGEX =
  /(?:https?:\/\/|www\.)[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/gi;

/** 텍스트에서 첫 번째 URL 추출 (없으면 null) */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

/** www. 또는 프로토콜 없는 URL에 https:// 보정 */
export function normalizeUrl(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

/** URL에서 hostname 추출 (www. 제거) */
export function getDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/** OG title 부재 시 path 기반 fallback 제목 (RN extractFallbackTitle 미러) */
export function extractFallbackTitle(url: string): string {
  try {
    const { hostname, pathname } = new URL(normalizeUrl(url));
    const normalizedHostname = hostname.replace('www.', '');

    if (normalizedHostname === 'kko.to' || normalizedHostname.endsWith('.kakao.com')) {
      return '카카오맵 링크';
    }

    if (pathname && pathname !== '/') {
      const decoded = decodeURIComponent(pathname).replace(/\//g, ' ').trim();
      if (decoded) return `${hostname} ${decoded}`.slice(0, 60);
    }
    return hostname;
  } catch {
    return url.slice(0, 60);
  }
}

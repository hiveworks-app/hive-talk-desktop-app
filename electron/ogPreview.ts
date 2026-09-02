import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * 링크 프리뷰 OG 파서 — 메인 프로세스판.
 *
 * 정적 export 전환(2026-09-02)으로 Next 서버 route(app/api/og-preview)가 사라져 이곳으로 이전.
 * 메인 프로세스는 브라우저가 아니라 CORS 제약 없이 외부 사이트를 직접 fetch할 수 있다.
 * 파서·SSRF 가드 로직은 기존 route.ts(= RN ogParser.ts 미러)를 그대로 옮긴 것.
 * LinkPreviewData 타입과 normalizeUrl/getDomain은 렌더러(src/shared/utils/linkPreview.ts)와
 * 동일 형태 유지 — electron/ tsconfig가 src를 포함하지 않아 소형 헬퍼는 여기 복제한다.
 */

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  domain?: string;
  thumbnailUrl?: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 8000;
const MAX_REDIRECTS = 5;

// ─── 소형 헬퍼 (src/shared/utils/linkPreview.ts 미러) ───────────────
function normalizeUrl(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

function getDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ─── OG/meta 파서 ───────────────────────────────────────────────
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** OG content의 HTML 엔티티 디코드 (&amp;, &#39;, &#x27; 등) — 카드에 문자 그대로 노출 방지 */
function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;|&#39;/gi, m => named[m.toLowerCase()] ?? m);
}

function extractMetaContent(
  html: string,
  attribute: 'property' | 'name',
  key: string,
): string | undefined {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]*${attribute}=["']${escapedKey}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escapedKey}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const content = html.match(pattern)?.[1]?.trim();
    if (content) return content;
  }
  return undefined;
}

function extractFirstContent(
  html: string,
  candidates: Array<{ attribute: 'property' | 'name'; key: string }>,
): string | undefined {
  for (const candidate of candidates) {
    const content = extractMetaContent(html, candidate.attribute, candidate.key);
    if (content) return content;
  }
  return undefined;
}

function sanitizeImageUrl(imageUrl: string | undefined, baseUrl: string): string | undefined {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return undefined;
  try {
    let urlString = trimmed;
    if (urlString.startsWith('//')) urlString = `https:${urlString}`;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = new URL(urlString, baseUrl).toString();
    }
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.pathname.toLowerCase().endsWith('.svg')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function buildFallback(url: string): LinkPreviewData {
  const domain = getDomain(url);
  if (domain === 'kko.to' || domain.endsWith('.kakao.com')) {
    return { url, title: '카카오맵 링크', domain };
  }
  return { url, domain };
}

async function parsePreviewResponse(response: Response, originalUrl: string): Promise<LinkPreviewData> {
  const text = await response.text();
  const headEnd = text.toLowerCase().indexOf('</head>');
  const html = headEnd > -1 ? text.slice(0, headEnd) : text.slice(0, MAX_HTML_BYTES);

  const title =
    extractFirstContent(html, [
      { attribute: 'property', key: 'og:title' },
      { attribute: 'name', key: 'twitter:title' },
    ]) ?? html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();

  const description = extractFirstContent(html, [
    { attribute: 'property', key: 'og:description' },
    { attribute: 'name', key: 'twitter:description' },
    { attribute: 'name', key: 'description' },
  ]);

  const image = extractFirstContent(html, [
    { attribute: 'property', key: 'og:image' },
    { attribute: 'name', key: 'twitter:image' },
  ]);

  return {
    url: originalUrl,
    title: title ? decodeHtmlEntities(title) : undefined,
    description: description ? decodeHtmlEntities(description) : undefined,
    thumbnailUrl: sanitizeImageUrl(image, response.url || originalUrl),
    domain: getDomain(response.url || originalUrl),
  };
}

// ─── SSRF 가드 ──────────────────────────────────────────────────
// 렌더러가 보낸 임의 URL을 메인이 fetch하므로 내부망/메타데이터 주소를 차단해야 한다.
// 호스트명 문자열만 검사하면 ① DNS rebinding(공개도메인→사설IP) ② 대체표기(127.1, 0x7f.., ::ffff:127.0.0.1)를
// 놓치므로, 실제 DNS 해석 후 모든 IP의 대역을 검사한다(dns.lookup은 IP 리터럴도 정규화).

/** IPv4/IPv6 주소가 내부(루프백/사설/링크로컬/ULA/CGNAT)인지 */
function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) → IPv4로 정규화
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const addr = mapped ? mapped[1] : ip;

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // 링크로컬(클라우드 메타데이터 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
    return false;
  }
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback/unspecified
    if (lower.startsWith('fe80')) return true; // 링크로컬
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    return false;
  }
  return true; // 알 수 없는 형식은 안전하게 차단
}

/** hostname을 DNS 해석해 모든 응답 IP가 공인인지 검사 (IP 리터럴도 lookup이 정규화) */
async function hostResolvesToPublic(hostname: string): Promise<boolean> {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  try {
    const records = await lookup(h, { all: true });
    if (records.length === 0) return false;
    return records.every(r => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

/**
 * SSRF-safe fetch — 수동 리다이렉트 루프로 매 홉마다 DNS 해석+대역 재검증.
 * (잔여: DNS rebinding TOCTOU는 해석↔연결 사이 창이 남음. 완전차단은 검증된 IP로 연결을 pin하는
 *  커스텀 dispatcher 필요 — 로컬 데스크톱 앱 맥락상 현 수준으로 충분 판단.)
 */
async function ssrfSafeFetch(initialUrl: string): Promise<Response | null> {
  let currentUrl = new URL(initialUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') return null;
    if (!(await hostResolvesToPublic(currentUrl.hostname))) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: 'manual', // 직접 따라가며 홉마다 재검증
        // SPA 사이트(네이버지도 등)는 알려진 스크래퍼 UA에게만 OG 태그를 SSR로 내려줌.
        // 자체 봇 UA로는 빈 껍데기 HTML만 응답 — 카카오톡 스크래퍼와 동일한 UA 조합 사용 (RN 패리티)
        headers: { 'User-Agent': 'facebookexternalhit/1.1;kakaotalk-scrap/1.0;' },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 3xx면 location을 재검증 후 다음 홉으로
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      try {
        currentUrl = new URL(location, currentUrl);
      } catch {
        return null;
      }
      continue;
    }

    return response;
  }

  return null; // 리다이렉트 과다
}

/** IPC 핸들러 본체 — 실패는 항상 fallback(url/domain)으로 응답해 카드가 최소 표시는 되게 한다 */
export async function getOgPreview(rawUrl: string): Promise<LinkPreviewData> {
  let target: URL;
  try {
    target = new URL(normalizeUrl(rawUrl));
  } catch {
    return buildFallback(rawUrl);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return buildFallback(rawUrl);
  }

  try {
    // 매 리다이렉트 홉마다 DNS 해석+사설대역 재검증 (SSRF 차단). 내부주소면 null → fallback만.
    const response = await ssrfSafeFetch(target.toString());
    if (!response || !response.ok) return buildFallback(rawUrl);
    return await parsePreviewResponse(response, rawUrl);
  } catch {
    return buildFallback(rawUrl);
  }
}

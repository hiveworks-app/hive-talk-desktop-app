/**
 * 채팅 텍스트 토크나이저 — URL/전화번호/이메일 자동 링크 (RN parseTextWithLinks 패리티).
 * RN 원본의 네이티브 액션(전화걸기·연락처 추가)은 데스크톱에 없으므로 순수 토큰화만 이식하고,
 * 클릭 액션은 렌더러(MessageContent)에서 데스크톱 방식(복사·mailto)으로 처리한다.
 */

/** URL 매칭 정규식 - http(s)://, www., 또는 도메인.확장자 패턴 */
const URL_REGEX =
  /(?:https?:\/\/|www\.)[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/gi;

/**
 * 전화번호 매칭 정규식 — 국내 번호체계 접두사 화이트리스트 기반 (앞뒤로 인접한 숫자가 없어야 함)
 * 휴대전화(010: 11자리 고정 / 구회선 011·016~019: 10~11자리),
 * 유선(실존 지역번호 + 국번 첫자리 2~9), 인터넷전화(070), 전국대표번호(15XX/16XX/18XX)
 * ※ 휴대전화 중간자리에는 2~9 제약을 걸지 않음 — 01X→010 번호통합 매핑으로
 *   010-0xxx/1xxx 실존 가능성을 배제할 수 없음
 * ※ 대표번호는 개별 프리픽스(1588, 1644 등) 열거 대신 제도상 지정 대역(1[568]XX) 전체를 허용
 *   — 대역 내 프리픽스는 통신사 배정에 따라 계속 추가되므로 열거 방식은 유지보수 부담
 */
const PHONE_PATTERNS = [
  '01(?:0[-\\s.]?\\d{4}|[16789][-\\s.]?\\d{3,4})', // 휴대전화
  '0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4])[-\\s.]?[2-9]\\d{2,3}', // 유선 (02, 031~033, 041~044, 051~055, 061~064)
  '070[-\\s.]?[2-9]\\d{3}', // 인터넷전화
  '1[568]\\d{2}', // 전국대표번호 (1588-1234 등 8자리)
].join('|');

const PHONE_REGEX = new RegExp(`(?<!\\d)(?:${PHONE_PATTERNS})[-\\s.]?\\d{4}(?!\\d)`, 'g');

/**
 * 형식은 유효하지만 실존 불가능한 번호 필터 (예: 010-0000-0000)
 * 뒤 8자리가 전부 0이면 미배정 번호로 판단.
 * 010-2222-2222류 반복 숫자는 실제 배정되는 골드번호일 수 있어 차단하지 않음.
 */
function isPlausiblePhoneNumber(matched: string): boolean {
  const digits = matched.replace(/\D/g, '');
  return /[1-9]/.test(digits.slice(-8));
}

/** 이메일 매칭 정규식 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export type TokenType = 'text' | 'link' | 'phone' | 'email';

export interface TextToken {
  text: string;
  isLink: boolean;
  type: TokenType;
}

/**
 * 토큰화 결과 LRU 캐시 — 메시지 텍스트는 불변이므로 같은 문자열은 항상 같은 결과.
 * ⚠️ 반환 배열은 캐시 공유 객체 — 호출부에서 변형(mutate) 금지.
 */
const PARSE_CACHE_MAX = 500;
const parseCache = new Map<string, TextToken[]>();

/** 텍스트를 일반 텍스트, 링크, 전화번호, 이메일 토큰으로 분리 */
export function parseTextWithLinks(text: string): TextToken[] {
  const cached = parseCache.get(text);
  if (cached) {
    // Map 삽입 순서 기반 LRU 갱신 (재삽입으로 최신화)
    parseCache.delete(text);
    parseCache.set(text, cached);
    return cached;
  }

  // URL과 전화번호를 동시에 매칭하여 위치순 정렬
  const matches: { index: number; length: number; text: string; type: TokenType }[] = [];

  for (const match of text.matchAll(URL_REGEX)) {
    if (match.index !== undefined) {
      matches.push({ index: match.index, length: match[0].length, text: match[0], type: 'link' });
    }
  }

  for (const match of text.matchAll(PHONE_REGEX)) {
    if (match.index !== undefined) {
      // URL 내부에 포함된 숫자는 전화번호로 인식하지 않음
      const isInsideUrl = matches.some(
        m => m.type === 'link' && match.index! >= m.index && match.index! < m.index + m.length,
      );
      if (!isInsideUrl && isPlausiblePhoneNumber(match[0])) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          type: 'phone',
        });
      }
    }
  }

  for (const match of text.matchAll(EMAIL_REGEX)) {
    if (match.index !== undefined) {
      // URL 내부에 포함된 이메일은 별도 처리하지 않음
      const isInsideOther = matches.some(
        m => match.index! >= m.index && match.index! < m.index + m.length,
      );
      if (!isInsideOther) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          type: 'email',
        });
      }
    }
  }

  // 위치순 정렬
  matches.sort((a, b) => a.index - b.index);

  const tokens: TextToken[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), isLink: false, type: 'text' });
    }
    tokens.push({ text: match.text, isLink: match.type === 'link', type: match.type });
    lastIndex = match.index + match.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), isLink: false, type: 'text' });
  }

  const result = tokens.length > 0 ? tokens : [{ text, isLink: false, type: 'text' as const }];

  if (parseCache.size >= PARSE_CACHE_MAX) {
    const oldest = parseCache.keys().next().value;
    if (oldest !== undefined) parseCache.delete(oldest);
  }
  parseCache.set(text, result);

  return result;
}

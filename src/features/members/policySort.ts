/**
 * 📐 멤버 목록 정책 정렬
 *
 * 정책: `hive-talk-policy/domain-policy/member.md`
 * - 한글 → 영문 → 숫자 → 특수문자 순으로 카테고리 그룹화
 * - 한글/영문 그룹 내부: ko collator 가나다순
 * - 숫자 그룹 내부: 1, 2, 3, 4, 5, 6, 7, 8, 9, 0 (0이 마지막)
 * - 특수문자 그룹 내부: ASCII 코드포인트 순
 *
 * 서버 `sort=name,ASC` 단독으로는 이 정책을 표현할 수 없어 클라이언트 후처리로 처리.
 */

// 모듈 스코프에 한 번만 생성 — localeCompare 대비 5~15배 빠름
const koCollator = new Intl.Collator('ko', { sensitivity: 'base', numeric: false });

const CATEGORY_HANGUL = 0;
const CATEGORY_ALPHA = 1;
const CATEGORY_DIGIT = 2;
const CATEGORY_SYMBOL = 3;

type Category = 0 | 1 | 2 | 3;

/**
 * 이름의 첫 글자 기준 카테고리 분류
 * 빈 문자열은 특수문자 그룹으로 취급(맨 뒤).
 */
function getCategory(name: string): Category {
  if (!name) return CATEGORY_SYMBOL;
  const ch = name.charCodeAt(0);
  // 한글 완성형 가 ~ 힣
  if (ch >= 0xac00 && ch <= 0xd7a3) return CATEGORY_HANGUL;
  // 한글 자모 (Hangul Jamo: 초/중/종성)
  if (ch >= 0x1100 && ch <= 0x11ff) return CATEGORY_HANGUL;
  // 한글 호환 자모 (Hangul Compatibility Jamo: ㄱ, ㄴ, ㅏ 등)
  // IME에서 자음만 입력해 닉네임을 만든 케이스가 실제로 들어옴
  if (ch >= 0x3130 && ch <= 0x318f) return CATEGORY_HANGUL;
  // 영문 대/소문자
  if ((ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a)) return CATEGORY_ALPHA;
  // 숫자 0~9
  if (ch >= 0x30 && ch <= 0x39) return CATEGORY_DIGIT;
  return CATEGORY_SYMBOL;
}

/**
 * 정책 숫자 순서: 1,2,3,4,5,6,7,8,9,0 → 0을 9 뒤로 보내기 위해 10으로 매핑
 */
function numericPolicyRank(ch: string): number {
  return ch === '0' ? 10 : Number(ch);
}

/**
 * 정책 기반 이름 비교 함수
 * - `Array.prototype.sort(comparePolicyMemberName)` 형태로 사용
 */
export function comparePolicyMemberName(a: string, b: string): number {
  const ca = getCategory(a);
  const cb = getCategory(b);
  if (ca !== cb) return ca - cb;

  // 같은 그룹 내부 정렬
  switch (ca) {
    case CATEGORY_DIGIT: {
      const ra = numericPolicyRank(a[0]);
      const rb = numericPolicyRank(b[0]);
      if (ra !== rb) return ra - rb;
      // 같은 숫자로 시작 → 코드포인트 비교로 안정화
      return a < b ? -1 : a > b ? 1 : 0;
    }
    case CATEGORY_SYMBOL: {
      const da = a.charCodeAt(0) - b.charCodeAt(0);
      if (da !== 0) return da;
      return a < b ? -1 : a > b ? 1 : 0;
    }
    case CATEGORY_HANGUL:
    case CATEGORY_ALPHA:
    default:
      // 한글/영문: ko collator로 자연스러운 가나다순
      return koCollator.compare(a, b);
  }
}

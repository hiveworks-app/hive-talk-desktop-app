// 한글 자모 분해
const decomposehangeul = (char: string): string[] => {
  const code = char.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const choseongIndex = Math.floor((code - 0xac00) / 28 / 21);
    const jungseongIndex = Math.floor((code - 0xac00) / 28) % 21;
    const jongseongIndex = (code - 0xac00) % 28;

    const choseong = [
      'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
      'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    ][choseongIndex];
    const jungseong = [
      'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
      'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
    ][jungseongIndex];
    const jongseong =
      jongseongIndex > 0
        ? [
            '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
            'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
          ][jongseongIndex]
        : '';

    return [choseong, jungseong, jongseong].filter(Boolean);
  }
  return [char];
};

const decomposeString = (str: string): string => {
  return str
    .split('')
    .map(char => decomposehangeul(char).join(''))
    .join('');
};

export const searchhangeul = (target: string, keyword: string): boolean => {
  const lowerTarget = target.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (lowerTarget.includes(lowerKeyword)) {
    return true;
  }

  const targetJamo = decomposeString(target);
  const keywordJamo = decomposeString(keyword);

  if (targetJamo.includes(keywordJamo)) {
    return true;
  }

  return false;
};

export const filterByhangeulSearch = <T>(
  items: T[],
  keyword: string,
  getSearchText: (item: T) => string,
): T[] => {
  if (!keyword.trim()) {
    return items;
  }

  return items.filter(item => searchhangeul(getSearchText(item), keyword));
};

// ────────────────────────────────────────────────
// 인덱스 룰러 라벨 (RN getIndexLabel 패리티)
// ────────────────────────────────────────────────

const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const TWIN_TO_PLAIN_CHOSEONG: Record<string, string> = {
  ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ',
};

/** 이름 첫 글자 → 룰러 인덱스 라벨 (한글 초성/영문 대문자/#) */
export function getIndexLabel(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const choseong = CHOSEONG_LIST[Math.floor((code - 0xac00) / 28 / 21)];
    return TWIN_TO_PLAIN_CHOSEONG[choseong] ?? choseong;
  }
  // 한글 호환 자모 단독 입력 닉네임 (ㄱ, ㄴ 등) — 초성 집합 밖 겹자음(ㄳ·ㄵ·ㄺ 등)은 '#' (RN 패리티)
  if (code >= 0x3131 && code <= 0x314e) {
    const plain = TWIN_TO_PLAIN_CHOSEONG[char] ?? char;
    return (CHOSEONG_LIST as readonly string[]).includes(plain) ? plain : '#';
  }
  if (/[a-zA-Z]/.test(char)) return char.toUpperCase();
  return '#';
}

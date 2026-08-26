/**
 * 휴대폰 번호 마스킹 (RN·정책 user.md 패리티): mid/tail 각각 앞 2자리 유지, 나머지 `*`.
 * 예: ('010','1234','5678') → '010-12**-56**'. 기존 `010-****-5678` 형식은 뒷자리 전체가
 * 노출되어 정책보다 개인정보를 더 드러냈다 (2026-08-26 전수 감사).
 */
export const formatMaskedPhone = (
  head?: string | null,
  mid?: string | null,
  tail?: string | null,
) => {
  const h = head?.trim() ?? '';
  const m = mid?.trim() ?? '';
  const t = tail?.trim() ?? '';
  if (!h && !m && !t) return '';
  const maskSuffix = (segment: string) =>
    segment.length > 2 ? `${segment.slice(0, 2)}${'*'.repeat(segment.length - 2)}` : segment;
  return [h, maskSuffix(m), maskSuffix(t)].filter(Boolean).join('-');
};

/** 전화번호 단일 문자열 → API 분리 형식 (phoneHead, phoneMid, phoneTail) */
export const parsePhoneParts = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return {
    phoneHead: digits.slice(0, 3),
    phoneMid: digits.slice(3, 7),
    phoneTail: digits.slice(7, 11),
  };
};

/** 전화번호 유효성 검증 (11자리 이상) */
export const isPhoneValid = (phone: string) => {
  return phone.replace(/\D/g, '').length >= 11;
};

/** 전화번호 파츠 유효성 검증 */
export const isPhonePartsValid = (parts: {
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
}) => {
  return parts.phoneHead.length >= 3 && parts.phoneMid.length >= 4 && parts.phoneTail.length >= 4;
};

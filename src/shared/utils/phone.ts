/**
 * 전화번호 파츠 → 가운데 자리 마스킹 형식 (예: 010-****-1234).
 * head/tail이 모두 없으면 빈 문자열을 반환한다.
 */
export const formatMaskedPhone = (
  head?: string | null,
  mid?: string | null,
  tail?: string | null,
) => {
  const h = head?.trim() ?? '';
  const t = tail?.trim() ?? '';
  if (!h && !t) return '';
  return `${h || '***'}-****-${t || '****'}`;
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

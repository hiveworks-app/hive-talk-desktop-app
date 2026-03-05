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

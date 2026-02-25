/**
 * 이메일 형식 검증
 * user@domain.tld 형태인지 확인 (co.kr 등 다단계 도메인 포함)
 */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * 비밀번호 유효성 검증
 * @returns 에러 메시지 (유효하면 빈 문자열)
 */
export const validatePassword = (password: string): string => {
  if (!password) {
    return '비밀번호를 입력해주세요';
  }
  if (/\s/.test(password)) {
    return '비밀번호에 공백을 포함할 수 없습니다';
  }
  if (password.length < 8) {
    return '비밀번호는 8자 이상이어야 합니다';
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasLetter || !hasNumber || !hasSpecial) {
    return '영문, 숫자, 특수문자를 포함해야 합니다';
  }

  return '';
};

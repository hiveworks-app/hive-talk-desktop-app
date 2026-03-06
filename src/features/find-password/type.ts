/** SMS 인증번호 발송 요청 (비밀번호 찾기) */
export interface FindPasswordSmsRequest {
  email: string;
  name: string;
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
}

/** SMS 인증코드 검증 요청 */
export interface FindPasswordVerifyRequest {
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  code: string;
}

/** 새 비밀번호 설정 요청 */
export interface FindPasswordResetRequest {
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  password: string;
  passwordConfirm: string;
}

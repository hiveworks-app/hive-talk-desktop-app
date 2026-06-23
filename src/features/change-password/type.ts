/** SMS 인증번호 발송 요청 body (비밀번호 변경) — 하이픈 없는 11자리 phoneFull */
export interface ChangePasswordSmsRequestProps {
  phoneFull: string;
}

/** SMS 인증코드 검증 요청 body */
export interface ChangePasswordSmsVerifyRequestProps {
  phoneFull: string;
  code: string;
}

/** 비밀번호 최종 변경 요청 body — 본인인증 컨텍스트 재검증을 위해 phoneFull 동반 */
export interface ChangePasswordRequestProps {
  phoneFull: string;
  password: string;
  passwordConfirm: string;
}

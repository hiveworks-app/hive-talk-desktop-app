/** 변경할 새 이메일로 인증 코드 발송 요청 body */
export interface ChangeEmailVerificationRequestProps {
  email: string;
}

/** 이메일 인증 코드 검증 요청 body */
export interface ChangeEmailVerifyRequestProps {
  email: string;
  code: string;
}

/** 이메일 최종 변경 요청 body */
export interface ChangeEmailRequestProps {
  email: string;
}

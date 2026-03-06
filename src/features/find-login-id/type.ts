/** SMS 인증번호 발송 요청 */
export interface FindLoginIdSmsRequest {
  name: string;
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
}

/** SMS 인증번호 확인 요청 */
export interface FindLoginIdVerifyRequest {
  name: string;
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  code: string;
}

/** 아이디 찾기 결과 - payload가 이메일 문자열로 직접 반환됨 */
export type FindLoginIdResult = string;

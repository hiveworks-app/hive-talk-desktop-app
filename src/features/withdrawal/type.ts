/**
 * 회원 탈퇴 요청 body
 * `DELETE /app/me/withdraw` 명세에 따라 본인 확인용 비밀번호를 전달한다.
 */
export interface WithdrawAccountRequest {
  password: string;
}

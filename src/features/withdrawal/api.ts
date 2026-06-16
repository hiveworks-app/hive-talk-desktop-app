import { request } from '@/shared/api';
import type { WithdrawAccountRequest } from './type';

/**
 * 🗑️ 회원 탈퇴 (로그인 사용자 본인)
 * 비밀번호로 본인 확인 후 계정 및 관련 데이터를 삭제한다. 표준 envelope 응답.
 */
export const apiWithdrawAccount = (data: WithdrawAccountRequest) =>
  request<void>('/app/me/withdraw', { method: 'DELETE', body: data });

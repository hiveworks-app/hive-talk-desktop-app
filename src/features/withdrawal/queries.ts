import { useMutation } from '@tanstack/react-query';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store/uiStore';
import { apiWithdrawAccount } from './api';

/** 비밀번호 불일치 서버 에러 코드 (스낵바 대신 화면 인라인 에러로 처리) */
export const WITHDRAW_PASSWORD_MISMATCH_CODE = 'U016';

/** 탈퇴 요청의 비밀번호 불일치(U016) 에러 여부 */
export const isWithdrawPasswordMismatch = (err: unknown): boolean =>
  isApiError(err) && err.code === WITHDRAW_PASSWORD_MISMATCH_CODE;

/**
 * 회원 탈퇴 mutation.
 * - 성공 처리(완료 화면 노출 → logout)는 호출부에서 담당한다. 성공 즉시 logout 하면
 *   (main) 가드가 로그인으로 보내 완료 화면이 스킵되므로 여기서는 logout 하지 않는다.
 * - 비밀번호 불일치(U016)는 호출부가 입력 필드 인라인 에러로 표시하므로 스낵바 생략.
 * - 그 외 실패만 스낵바로 안내하며, 어떤 실패든 세션은 유지한다.
 */
export const useWithdrawAccount = () => {
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: apiWithdrawAccount,
    onError: err => {
      if (isWithdrawPasswordMismatch(err)) return;
      const message = isApiError(err)
        ? err.message || '탈퇴에 실패했습니다.'
        : '탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.';
      showSnackbar({ message, state: 'error' });
    },
  });
};

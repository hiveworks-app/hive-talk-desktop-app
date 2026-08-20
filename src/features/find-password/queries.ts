import { useMutation } from '@tanstack/react-query';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';
import { apiFindPasswordReset, apiFindPasswordSendSms, apiFindPasswordVerify } from './api';

/** 비밀번호 찾기 SMS 발송 — 발송 실패(없는 계정 등)는 호출부에서 Input 하단 인라인 에러로 처리 */
export const useFindPasswordSendSms = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiFindPasswordSendSms,
    onSuccess: () => {
      showSnackbar({
        message: '인증번호가 발송되었습니다.',
        state: 'success',
      });
    },
  });
};

/** 비밀번호 찾기 인증코드 검증 — 실패는 useFindPassword 훅에서 인라인 (n/5)로 처리 */
export const useFindPasswordVerify = () => {
  return useMutation({
    mutationFn: apiFindPasswordVerify,
  });
};

/** 새 비밀번호 설정 */
export const useFindPasswordReset = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiFindPasswordReset,
    onSuccess: () => {
      showSnackbar({
        message: '비밀번호가 변경되었습니다.',
        state: 'success',
      });
    },
    onError: (err: unknown) => {
      if (isApiError(err)) {
        showSnackbar({
          message: err.message || '비밀번호 변경에 실패했습니다.',
          state: 'error',
        });
        return;
      }
      showSnackbar({
        message: '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.',
        state: 'error',
      });
    },
  });
};

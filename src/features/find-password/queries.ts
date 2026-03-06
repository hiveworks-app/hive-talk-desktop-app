import { useMutation } from '@tanstack/react-query';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';
import { apiFindPasswordReset, apiFindPasswordSendSms, apiFindPasswordVerify } from './api';

/** 비밀번호 찾기 SMS 발송 */
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
    onError: (err: unknown) => {
      if (isApiError(err)) {
        showSnackbar({
          message: err.message || '인증번호 발송에 실패했습니다.',
          state: 'error',
        });
        return;
      }
      showSnackbar({
        message: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        state: 'error',
      });
    },
  });
};

/** 비밀번호 찾기 인증코드 검증 */
export const useFindPasswordVerify = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiFindPasswordVerify,
    onError: (err: unknown) => {
      if (isApiError(err)) {
        showSnackbar({
          message: err.message || '인증번호가 일치하지 않습니다.',
          state: 'error',
        });
        return;
      }
      showSnackbar({
        message: '인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
        state: 'error',
      });
    },
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

import { useMutation } from '@tanstack/react-query';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';
import { apiFindLoginIdSendSms, apiFindLoginIdVerify } from './api';

/** 아이디 찾기 SMS 발송 */
export const useFindLoginIdSendSms = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiFindLoginIdSendSms,
    onSuccess: () => {
      showSnackbar({
        message: '인증번호가 발송되었습니다.',
        state: 'success',
      });
    },
    onError: (err: unknown) => {
      if (isApiError(err)) {
        showSnackbar({
          message: err.message || '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
          state: 'error',
        });
        return;
      }
      showSnackbar({
        message: '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        state: 'error',
      });
    },
  });
};

/** 아이디 찾기 인증 확인 → 이메일 반환 */
export const useFindLoginIdVerify = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiFindLoginIdVerify,
    onError: (err: unknown) => {
      if (isApiError(err)) {
        showSnackbar({
          message: err.message || '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
          state: 'error',
        });
        return;
      }
      showSnackbar({
        message: '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        state: 'error',
      });
    },
  });
};

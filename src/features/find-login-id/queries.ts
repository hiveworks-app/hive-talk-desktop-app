import { useMutation } from '@tanstack/react-query';
import { useUIStore } from '@/store';
import { apiFindLoginIdSendSms, apiFindLoginIdVerify } from './api';

/** 아이디 찾기 SMS 발송 — 발송 실패(일치 계정 없음 등)는 호출부에서 인라인 에러로 처리 */
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
  });
};

/** 아이디 찾기 인증 확인 → 이메일 반환 (에러는 useFindLoginId 훅에서 인라인 처리) */
export const useFindLoginIdVerify = () => {
  return useMutation({
    mutationFn: apiFindLoginIdVerify,
  });
};

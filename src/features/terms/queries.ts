'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ME_TERMS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetMyTerms,
  apiTurnOffAdInfoConsent,
  apiTurnOffMarketingConsent,
  apiTurnOnAdInfoConsent,
  apiTurnOnMarketingConsent,
} from './api';
import type { MyTermsResponse, TermsCode } from './type';
import { TERMS_CODE } from './type';

/** 5분 룰 — 5분 이내 재진입은 noop, 초과 시 자동 refetch (push 설정과 동일 정책) */
const ME_TERMS_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * 본인 약관 동의 현황 전체(5종) 조회. 서버가 SSOT, 화면은 본 query를 그대로 표시.
 * 가입 종류(UserRole) 분기는 서버에서 자동 처리한다.
 */
export const useGetMyTerms = () => {
  const accessToken = useAuthStore(s => s.accessToken);
  return useQuery({
    queryKey: ME_TERMS_KEY,
    queryFn: async () => {
      const res = await apiGetMyTerms();
      return res.payload;
    },
    staleTime: ME_TERMS_STALE_TIME_MS,
    enabled: !!accessToken,
  });
};

/**
 * 선택 약관 동의 토글 공통 optimistic mutation 팩토리.
 * - onMutate: 매칭 code의 isAgreed만 즉시 캐시 반영 + 이전 값 보관
 * - onError: 이전 값으로 rollback
 * - onSettled: consentedAt/revokedAt 타임스탬프 정합을 위해 refetch
 */
function useToggleConsent(code: TermsCode, onMutation: (enabled: boolean) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => onMutation(enabled),
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: ME_TERMS_KEY });
      const previous = queryClient.getQueryData<MyTermsResponse>(ME_TERMS_KEY);
      queryClient.setQueryData<MyTermsResponse | undefined>(ME_TERMS_KEY, prev =>
        prev
          ? {
              ...prev,
              items: prev.items.map(item =>
                item.code === code ? { ...item, isAgreed: enabled } : item,
              ),
            }
          : prev,
      );
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ME_TERMS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ME_TERMS_KEY });
    },
  });
}

/** 마케팅 목적 개인정보 이용 동의 ON/OFF */
export const useToggleMarketingConsent = () =>
  useToggleConsent(TERMS_CODE.MARKETING, enabled =>
    enabled ? apiTurnOnMarketingConsent() : apiTurnOffMarketingConsent(),
  );

/** 광고성 정보 수신 동의 ON/OFF */
export const useToggleAdInfoConsent = () =>
  useToggleConsent(TERMS_CODE.AD_INFO, enabled =>
    enabled ? apiTurnOnAdInfoConsent() : apiTurnOffAdInfoConsent(),
  );

import { useMutation, useQuery } from '@tanstack/react-query';
import { REPORT_CATEGORIES_STALE_TIME_MS } from '@/shared/config/constants';
import { REPORT_CATEGORIES_KEY } from '@/shared/config/queryKeys';
import { apiGetReportCategories, apiReportMessage } from './api';
import { FALLBACK_REPORT_CATEGORIES } from './reportCategories';

/**
 * 신고 사유 카테고리 목록 조회.
 *
 * - 서버가 SSOT. 신고하기 목록/세부 화면 모두 본 query 데이터로 렌더한다.
 * - placeholderData: 응답 도착 전·네트워크 실패 시에도 정본 폴백을 노출해
 *   신고 화면이 비지 않도록 한다. placeholder 는 캐시에 기록되지 않아
 *   서버 응답이 오면 그대로 대체된다.
 * - staleTime 1시간: 카테고리는 운영 중 변경이 드물어 길게 유지.
 */
export const useGetReportCategories = () =>
  useQuery({
    queryKey: REPORT_CATEGORIES_KEY,
    queryFn: async () => {
      const res = await apiGetReportCategories();
      return res.payload;
    },
    staleTime: REPORT_CATEGORIES_STALE_TIME_MS,
    placeholderData: FALLBACK_REPORT_CATEGORIES,
  });

/**
 * 메시지 신고 접수 mutation (POST /app/reports/messages).
 *
 * - 응답에 payload 가 없고(success/code/message) 갱신할 캐시도 없어 mutationFn 만 둔다.
 * - 실패 분기(이미 신고 RP003 등)는 호출부(세부 화면)가 ApiError 로 처리한다.
 */
export const useReportMessage = () =>
  useMutation({
    mutationFn: apiReportMessage,
  });

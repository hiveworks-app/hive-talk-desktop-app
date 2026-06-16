import { request } from '@/shared/api';
import type { ReportCategoriesPayload, ReportMessageBody } from './type';

/** 신고 사유 카테고리 목록 조회 (활성 카테고리만, 노출 순서대로) */
export const apiGetReportCategories = () =>
  request<ReportCategoriesPayload>('/app/reports/categories', { method: 'GET' });

/**
 * 메시지 신고 접수
 * - 201/S002 성공. 주요 실패: RP001 본인 메시지 신고 불가(400) /
 *   RP002 메시지 없음(404) / RP003 이미 신고한 메시지(409) / RP004 기타 사유 상세 누락(400)
 */
export const apiReportMessage = (body: ReportMessageBody) =>
  request<null>('/app/reports/messages', { method: 'POST', body });

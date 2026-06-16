/**
 * 신고(Report) 서버 응답 타입
 * - GET /app/reports/categories
 */

/** 신고 사유 카테고리. code 는 추후 신고 접수 API 요청 본문에도 그대로 사용한다. */
export interface ReportCategory {
  code: string;
  name: string;
  /** true(기타)면 세부 화면에서 자유 입력형 "신고 내용"을 요구한다. */
  requiresDetail: boolean;
  /** 카테고리별 빨간 "주의사항" 문구 — 있는 카테고리만 내려온다. */
  caution?: string | null;
  /** 세부 화면 위반 행위 예시 — 디스크 불릿으로 노출 */
  descriptions: string[];
}

/** GET /app/reports/categories payload */
export interface ReportCategoriesPayload {
  /** 활성 카테고리 목록 — 서버가 내려준 순서 그대로 노출한다. */
  categories: ReportCategory[];
  /** 신고하기(목록) 화면 하단 공통 안내 문구 */
  notice: string;
}

/** 신고 접수 API 의 방 타입 — WS_CHANNEL_TYPE 을 축약 코드로 매핑해 전달한다. */
export const REPORT_ROOM_TYPES = ['DM', 'GM', 'EM'] as const;
export type ReportRoomType = (typeof REPORT_ROOM_TYPES)[number];

export function isReportRoomType(value: string | undefined): value is ReportRoomType {
  return REPORT_ROOM_TYPES.some(roomType => roomType === value);
}

/** POST /app/reports/messages 요청 본문 */
export interface ReportMessageBody {
  roomType: ReportRoomType;
  roomId: string;
  messageId: string;
  /** 신고 사유 code (GET /app/reports/categories 의 categories[].code) */
  reasonCategory: string;
  /** requiresDetail(기타) 카테고리일 때만 포함하는 직접 입력 사유 */
  reasonDetail?: string;
}

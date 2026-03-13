/** 공지사항 표시 상태 */
export type NoticeDisplayStatus = 'VISIBLE' | 'FOLDED' | 'DISMISSED';

/** 공지사항 모델 (서버 응답) */
export interface NoticeModel {
  noticeId: number;
  userId: number;
  title: string;
  content: string;
  displayStatus: NoticeDisplayStatus;
  createdAt: string;
  updatedAt: string;
}

/** 공지 생성/수정 요청 */
export interface NoticeRequest {
  title: string;
  content: string;
}

/** 표시 상태 변경 요청 */
export interface NoticeDisplayRequest {
  displayStatus: 'VISIBLE' | 'FOLDED';
}

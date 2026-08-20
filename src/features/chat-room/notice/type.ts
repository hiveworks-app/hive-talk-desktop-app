import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

/** 공지사항 표시 상태 */
export type NoticeDisplayStatus = 'VISIBLE' | 'FOLDED' | 'DISMISSED';

/**
 * IMAGE/MEDIA/FILE 공지 payload의 meta.
 * 서버는 자유 형식(key/value)으로 보존하지만 클라이언트가 사용하는 키만 명시한다. (RN v2 패리티)
 */
export interface NoticeFileMeta {
  /** MIME 타입 (예: "image/jpeg", "video/mp4") */
  type?: string;
  /** 파일 크기 (bytes) */
  size?: number;
  /** 미디어 재생 시간 (초) */
  duration?: number | string;
  /** 썸네일 S3 path (MEDIA) */
  thumbnail?: string;
  /** 서버가 응답에 자동 추가 — 요청 시 보내지 말 것 */
  thumbnailPresignedUrl?: string;
}

/** TEXT 공지 payload */
export interface NoticeTextPayload {
  content: string;
}

/** IMAGE/MEDIA/FILE 공지 payload */
export interface NoticeFilePayload {
  /** S3 path — 표시 시 presigned 조회에 사용 */
  path: string;
  meta?: NoticeFileMeta;
  /** 서버가 응답에 자동 추가 — 요청 시 보내지 말 것. 만료가 있어 표시용은 path 기반 presigned 조회 사용 */
  presignedUrl?: string;
}

interface NoticeModelBase {
  noticeId: number;
  userId: number;
  title: string;
  displayStatus: NoticeDisplayStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TextNoticeModel extends NoticeModelBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.TEXT;
  payload: NoticeTextPayload;
}

export interface ImageNoticeModel extends NoticeModelBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.IMAGE;
  payload: NoticeFilePayload;
}

export interface MediaNoticeModel extends NoticeModelBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.MEDIA;
  payload: NoticeFilePayload;
}

export interface FileNoticeModel extends NoticeModelBase {
  messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.FILE;
  payload: NoticeFilePayload;
}

/** 공지사항 모델 (v2 서버 응답) — messageContentType으로 판별되는 유니온 (RN 패리티) */
export type NoticeModel = TextNoticeModel | ImageNoticeModel | MediaNoticeModel | FileNoticeModel;

/**
 * v1 공지 응답 형태 (title에 유형 마커, content에 텍스트/경로/JSON 저장).
 * 서버 마이그레이션 이전에 등록된 공지가 v1 형태로 응답될 가능성에 대비한 하위호환용.
 */
export interface LegacyNoticeModel extends NoticeModelBase {
  content: string;
}

/** 공지 생성/수정 요청 (v2) — { title, messageContentType, payload } */
export type NoticeRequest =
  | {
      title: string;
      messageContentType: typeof WS_MESSAGE_CONTENT_TYPE.TEXT;
      payload: NoticeTextPayload;
    }
  | {
      title: string;
      messageContentType:
        | typeof WS_MESSAGE_CONTENT_TYPE.IMAGE
        | typeof WS_MESSAGE_CONTENT_TYPE.MEDIA
        | typeof WS_MESSAGE_CONTENT_TYPE.FILE;
      payload: NoticeFilePayload;
    };

/** 표시 상태 변경 요청 */
export interface NoticeDisplayRequest {
  displayStatus: NoticeDisplayStatus;
}

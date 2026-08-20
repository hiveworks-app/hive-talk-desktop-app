import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { extractFileName } from '@/shared/utils/fileUtils';
import type {
  FileNoticeModel,
  ImageNoticeModel,
  LegacyNoticeModel,
  MediaNoticeModel,
  NoticeFileMeta,
  NoticeModel,
  TextNoticeModel,
} from './type';

/** 공지 v2 타입 판별자 — messageContentType 기반 (RN noticeUtils 패리티) */
export const isTextNotice = (notice: NoticeModel): notice is TextNoticeModel =>
  notice.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT;

export const isImageNotice = (notice: NoticeModel): notice is ImageNoticeModel =>
  notice.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE;

export const isMediaNotice = (notice: NoticeModel): notice is MediaNoticeModel =>
  notice.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA;

export const isFileNotice = (notice: NoticeModel): notice is FileNoticeModel =>
  notice.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;

/** FILE 공지 표시 정보 — 파일명은 S3 path의 마지막 세그먼트(원본 파일명)에서 유도 */
export const getFileNoticeInfo = (notice: FileNoticeModel) => ({
  filePath: notice.payload.path,
  fileName: extractFileName(notice.payload.path),
  fileSize: notice.payload.meta?.size ?? 0,
  mimeType: notice.payload.meta?.type ?? '',
});

/**
 * 메시지 파일 meta → 공지 요청 meta.
 * 서버가 응답 시 자동 생성하는 presigned 키는 요청에 포함하면 안 되므로(서버 스펙),
 * 클라이언트가 사용하는 키만 명시적으로 옮긴다.
 */
export const toNoticeRequestMeta = (
  meta: NoticeFileMeta | undefined,
): NoticeFileMeta | undefined => {
  if (!meta) return undefined;
  const { type, size, duration, thumbnail } = meta;
  return { type, size, duration, thumbnail };
};

/** v1 공지의 MEDIA content 필드에 저장되던 구조 */
interface LegacyMediaNoticeContent {
  videoPath: string;
  thumbnailPath?: string;
}

/** v1 공지의 FILE content 필드에 저장되던 구조 */
interface LegacyFileNoticeContent {
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

const parseLegacyJson = <T,>(content: string): T | null => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed !== null && typeof parsed === 'object') return parsed as T;
  } catch {
    // JSON이 아닌 v1 content → null
  }
  return null;
};

/**
 * 공지 응답을 v2 NoticeModel로 정규화 (RN 패리티).
 * 서버 마이그레이션 이전에 등록된 v1 공지(title=유형 마커, content=텍스트/경로/JSON)가
 * 그대로 응답될 가능성에 대비한 하위호환 변환. v2 응답(payload 존재)은 그대로 통과한다.
 */
export const normalizeNoticeModel = (
  raw: NoticeModel | LegacyNoticeModel | null | undefined,
): NoticeModel | null => {
  if (!raw) return null;
  if ('payload' in raw) return raw;

  const { content, ...base } = raw;

  if (base.title === WS_MESSAGE_CONTENT_TYPE.IMAGE) {
    return {
      ...base,
      messageContentType: WS_MESSAGE_CONTENT_TYPE.IMAGE,
      payload: { path: content },
    };
  }

  if (base.title === WS_MESSAGE_CONTENT_TYPE.MEDIA) {
    const parsed = parseLegacyJson<LegacyMediaNoticeContent>(content);
    return {
      ...base,
      messageContentType: WS_MESSAGE_CONTENT_TYPE.MEDIA,
      payload: {
        path: parsed?.videoPath ?? '',
        meta: parsed?.thumbnailPath ? { thumbnail: parsed.thumbnailPath } : undefined,
      },
    };
  }

  if (base.title === WS_MESSAGE_CONTENT_TYPE.FILE) {
    const parsed = parseLegacyJson<LegacyFileNoticeContent>(content);
    return {
      ...base,
      messageContentType: WS_MESSAGE_CONTENT_TYPE.FILE,
      payload: {
        path: parsed?.filePath ?? '',
        meta: { size: parsed?.fileSize, type: parsed?.mimeType },
      },
    };
  }

  return {
    ...base,
    messageContentType: WS_MESSAGE_CONTENT_TYPE.TEXT,
    payload: { content },
  };
};

import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import type { NoticeModel } from './type';

/**
 * 공지 콘텐츠 타입 판별 — `title` 필드를 타입 마커로 재활용 (RN noticeUtils 미러).
 * title === 'IMAGE'|'MEDIA'|'FILE' → 해당 미디어 공지, 그 외 → 텍스트 공지.
 * content 인코딩: IMAGE=storage path, MEDIA/FILE=JSON 문자열.
 */

export const isImageNotice = (notice: NoticeModel) =>
  notice.title === WS_MESSAGE_CONTENT_TYPE.IMAGE;

export const isMediaNotice = (notice: NoticeModel) =>
  notice.title === WS_MESSAGE_CONTENT_TYPE.MEDIA;

export const isFileNotice = (notice: NoticeModel) =>
  notice.title === WS_MESSAGE_CONTENT_TYPE.FILE;

/** MEDIA 공지 content JSON 구조 */
export interface MediaNoticeContent {
  videoPath: string;
  thumbnailPath: string;
}

/** MEDIA 공지 content 파싱 (실패 시 null — backward compat) */
export const parseMediaNoticeContent = (content: string): MediaNoticeContent | null => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'videoPath' in parsed &&
      typeof (parsed as MediaNoticeContent).videoPath === 'string'
    ) {
      const { videoPath, thumbnailPath } = parsed as MediaNoticeContent;
      return { videoPath, thumbnailPath: thumbnailPath ?? '' };
    }
  } catch {
    // JSON 파싱 실패 → null
  }
  return null;
};

/** FILE 공지 content JSON 구조 */
export interface FileNoticeContent {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** FILE 공지 content 파싱 (실패 시 null — backward compat) */
export const parseFileNoticeContent = (content: string): FileNoticeContent | null => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed !== null && typeof parsed === 'object' && 'filePath' in parsed) {
      const { filePath, fileName, fileSize, mimeType } = parsed as FileNoticeContent;
      return {
        filePath: filePath ?? '',
        fileName: fileName ?? '',
        fileSize: fileSize ?? 0,
        mimeType: mimeType ?? '',
      };
    }
  } catch {
    // JSON 파싱 실패 → null
  }
  return null;
};

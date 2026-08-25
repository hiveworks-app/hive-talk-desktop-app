import { WebSocketPublishItem } from '@/shared/types/websocket';
import { UNKNOWN_USER_NAME } from '@/shared/config/constants';
import { MediaListType } from '@/shared/types/media';

export const convertedMediaList = (cachedAttachments: WebSocketPublishItem[]): MediaListType[] => {
  return cachedAttachments.flatMap(item => {
    const { message, sender } = item;

    if (
      message.messageContentType !== 'IMAGE' &&
      message.messageContentType !== 'MEDIA' &&
      message.messageContentType !== 'FILE'
    ) {
      return [];
    }

    const messageItem = message.payload?.items ?? [];

    return messageItem.map(media => ({
      id: media.path,
      messageId: message.id,
      createdAt: message.createdAt,
      messageContentType: message.messageContentType,
      thumbnailPath: media.meta.thumbnail,
      thumbnailPresignedUrl: media.meta.thumbnailPresignedUrl,
      presignedUrl: media.presignedUrl,
      path: media.path,
      author: sender?.isDeleted === true ? UNKNOWN_USER_NAME : sender?.name || '작성자',
      senderId: sender?.userId != null ? String(sender.userId) : undefined,
      fileSize: media.meta.size,
      duration: media.meta.duration,
    }));
  });
};

/** 보관함 날짜 그룹 헤더 포맷 (RN utils.formatDate 패리티 — "YYYY. MM. DD") */
export const formatSidePanelDate = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}. ${mm}. ${dd}`;
};

/** 날짜별 그룹 (RN SidePanelSelectItemList groupedMediaList 패리티 — 목록 순서 보존) */
export const groupByDate = <T extends { createdAt: string }>(
  list: T[],
): { date: string; items: T[] }[] => {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of list) {
    const key = formatSidePanelDate(item.createdAt);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map(date => ({ date, items: map.get(date)! }));
};

export interface BundledMedia extends MediaListType {
  /** 같은 메시지로 보낸 장수 — 1이면 단독 */
  bundleCount: number;
  /** 묶음 전체 id — 선택 토글은 묶음 단위 (RN 패리티) */
  bundleItemIds: string[];
}

/** 미디어 묶음 처리 (RN SidePanelSelectItem displayList 패리티 — messageId 기준 대표 1개.
 *  파일 탭은 평면 유지가 RN 규칙이므로 미디어 탭에서만 사용한다) */
export const bundleMediaByMessage = (list: MediaListType[]): BundledMedia[] => {
  const groups = new Map<string, MediaListType[]>();
  const representatives: MediaListType[] = [];
  for (const item of list) {
    if (!groups.has(item.messageId)) {
      groups.set(item.messageId, []);
      representatives.push(item);
    }
    groups.get(item.messageId)!.push(item);
  }
  return representatives.map(rep => {
    const items = groups.get(rep.messageId)!;
    return { ...rep, bundleCount: items.length, bundleItemIds: items.map(i => i.id) };
  });
};

const MAX_REASONABLE_BYTES = 1e15; // RN 동일 — 1PB 초과는 비정상 데이터로 간주

/** 보관함 총 용량 표기 — 숫자/단위 분리 (RN SidePanelSelectItemTitle formatSizeParts 패리티) */
export function formatSizeParts(bytes: number): { value: string; unit: string } {
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_REASONABLE_BYTES)
    return { value: '0', unit: 'B' };
  if (bytes >= 1e12) return { value: (bytes / 1e12).toFixed(1), unit: 'TB' };
  if (bytes >= 1e9) return { value: (bytes / 1e9).toFixed(1), unit: 'GB' };
  if (bytes >= 1e6) return { value: (bytes / 1e6).toFixed(1), unit: 'MB' };
  if (bytes >= 1e3) return { value: (bytes / 1e3).toFixed(1), unit: 'KB' };
  return { value: String(bytes), unit: 'B' };
}

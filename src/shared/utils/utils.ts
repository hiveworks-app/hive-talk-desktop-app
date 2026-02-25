import { WebSocketMessageType } from '@/shared/types/websocket';

export type DeviceTypes = 'DESKTOP';

export const getDeviceType = (): DeviceTypes => 'DESKTOP';

/**
 * api 파라미터 세팅시 빈 값들은 null 변환해주는 함수
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function toNullable<T extends Exclude<any, boolean>>(value: T | null | undefined): T | null {
  return value === null || value === undefined ? null : value;
}

/**
 * 문자열 Normalizer
 * - falsy → ''
 * - 그 외 → trim 적용 후 반환
 */
export function toStringSafe(value: unknown): string {
  if (!value) return '';
  return String(value).trim();
}

export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

export const convertedDate = (date: Date) => {
  if (!date) return;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
    String(date.getMilliseconds()).padStart(3, '0'),
  ].join('-');
};

export const formatDate = (date: string) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}. ${mm}. ${dd}`;
};

export const getSaveFileName = (fileUrl: string, type: WebSocketMessageType, index: number) => {
  const rawName = fileUrl.split('/').pop() ?? (type === 'MEDIA' ? 'video.mp4' : 'image.jpg');
  const [nameWithoutQuery] = rawName.split('?');

  const dotIndex = nameWithoutQuery.lastIndexOf('.');
  const hasExt = dotIndex !== -1;
  const ext = hasExt ? nameWithoutQuery.slice(dotIndex) : type === 'MEDIA' ? '.mp4' : '.jpg';
  const baseName = hasExt ? nameWithoutQuery.slice(0, dotIndex) : nameWithoutQuery;
  const numbering: string =
    index < 10 ? `00${index + 1}` : index < 100 ? `0${index + 1}` : String(index + 1);

  return `${baseName}-${convertedDate(new Date())}-${numbering}${ext}`;
};

export function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function safeJsonParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * 경로에서 파일명만 추출
 */
export const extractFileName = (uri: string): string => {
  if (!uri) return '';
  return uri.split('/').pop() ?? '';
};

/**
 * 파일 용량 변환기
 */
export function formatBytes(
  bytes?: number,
  options?: {
    decimals?: number;
    fallback?: string;
  },
) {
  if (bytes == null || isNaN(bytes)) {
    return options?.fallback ?? '';
  }

  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = options?.decimals ?? 1;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(dm)} ${sizes[i]}`;
}

/**
 * 경로에서 파일명만 추출
 */
export const extractFileName = (uri: string): string => {
  if (!uri) return '';
  // NFC 정규화 — macOS/iOS 업로드 파일명은 자소 분리(NFD)로 저장되어 키보드 입력(NFC)과
  // 바이트가 달라 검색 includes가 실패한다. 표시·검색·하이라이트가 모두 이 관문을 거친다 (RN C11 패리티)
  return (uri.split('/').pop() ?? '').normalize('NFC');
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

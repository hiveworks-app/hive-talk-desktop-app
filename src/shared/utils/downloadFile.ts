/**
 * presigned URL의 파일을 blob으로 받아 디스크로 저장한다.
 * Electron 렌더러에서 <a download>가 네이티브 다운로드를 트리거한다
 * (CORS는 Electron webRequest 헤더 주입으로 ncloudstorage/hiveworks 도메인 허용됨).
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // 다운로드 시작 후 약간의 지연을 두고 해제 (즉시 해제 시 일부 환경에서 취소될 수 있음)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

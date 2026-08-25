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

/**
 * 일괄 다운로드용 — Electron이면 main 프로세스 downloadURL로 OS 다운로드 폴더에 조용히 저장.
 * 렌더러 anchor 연쇄 클릭은 크로미엄이 '자동 다운로드'로 판정해 첫 건 이후를 조용히 버리므로
 * (에러조차 없음) 일괄에는 쓸 수 없다. 웹 브라우저에서는 anchor 방식으로 폴백.
 */
export async function downloadFileSilently(url: string, filename: string, directory?: string): Promise<void> {
  const api = (window as unknown as {
    electronAPI?: {
      downloadFile?: (d: { url: string; filename: string; directory?: string }) => Promise<boolean>;
    };
  }).electronAPI;
  if (api?.downloadFile) {
    const ok = await api.downloadFile({ url, filename, directory });
    if (!ok) throw new Error('다운로드 실패');
    return;
  }
  await downloadFileFromUrl(url, filename);
}

/**
 * 일괄 다운로드 저장 폴더 선택.
 * @returns 선택한 절대 경로 / null=사용자 취소 / undefined=폴더 선택 미지원(웹 브라우저)
 */
export async function chooseDownloadDirectory(): Promise<string | null | undefined> {
  const api = (window as unknown as {
    electronAPI?: { chooseDownloadDirectory?: () => Promise<string | null> };
  }).electronAPI;
  if (!api?.chooseDownloadDirectory) {
    // Electron인데 메서드가 없다 = preload가 재시작 전 구버전 (electron/ 변경은 재컴파일+재시작 필수)
    if (api) console.warn('[download] chooseDownloadDirectory 미노출 — Electron 재시작 필요(구버전 preload)');
    return undefined;
  }
  return api.chooseDownloadDirectory();
}

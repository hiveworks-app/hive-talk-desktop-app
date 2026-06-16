'use client';

import { useState } from 'react';
import { downloadFileFromUrl } from '@/shared/utils/downloadFile';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useUIStore } from '@/store/uiStore';

/**
 * 사이드패널 파일/미디어 개별 다운로드 훅.
 * 다운로드 중인 항목 id를 노출해 호출부가 스피너/비활성화를 표시할 수 있게 한다.
 */
export function useFileDownload() {
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = async (id: string, url: string | undefined, filename: string) => {
    if (downloadingId) return; // 동시 다운로드 1건으로 제한
    if (!url) {
      showSnackbar({ message: '다운로드 주소를 찾을 수 없습니다.', state: 'error' });
      return;
    }
    if (isOffline()) return;

    setDownloadingId(id);
    try {
      await downloadFileFromUrl(url, filename);
    } catch {
      showSnackbar({ message: '다운로드에 실패했습니다.', state: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  return { download, downloadingId };
}

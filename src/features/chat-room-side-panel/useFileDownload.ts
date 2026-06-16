'use client';

import { useState } from 'react';
import { downloadFileFromUrl } from '@/shared/utils/downloadFile';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useUIStore } from '@/store/uiStore';

export interface BulkDownloadItem {
  url?: string;
  filename: string;
}

/**
 * 사이드패널 파일/미디어 다운로드 훅 (개별 + 일괄).
 * 다운로드 중인 항목 id / 일괄 진행 여부를 노출해 호출부가 스피너·비활성화를 표시한다.
 */
export function useFileDownload() {
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const download = async (id: string, url: string | undefined, filename: string) => {
    if (downloadingId || bulkDownloading) return; // 동시 다운로드 제한
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

  /** 선택 항목 일괄 다운로드 — 순차 저장(연속 트리거 간격 250ms) */
  const downloadMany = async (items: BulkDownloadItem[]) => {
    if (bulkDownloading || downloadingId || items.length === 0) return;
    if (isOffline()) return;

    setBulkDownloading(true);
    let failed = 0;
    for (const item of items) {
      if (!item.url) {
        failed++;
        continue;
      }
      try {
        await downloadFileFromUrl(item.url, item.filename);
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch {
        failed++;
      }
    }
    setBulkDownloading(false);

    const ok = items.length - failed;
    if (failed === 0) {
      showSnackbar({ message: `${ok}개 다운로드를 시작했어요.`, state: 'success' });
    } else if (ok === 0) {
      showSnackbar({ message: '다운로드에 실패했습니다.', state: 'error' });
    } else {
      showSnackbar({ message: `${ok}개 시작, ${failed}개 실패`, state: 'warning' });
    }
  };

  return { download, downloadingId, downloadMany, bulkDownloading };
}

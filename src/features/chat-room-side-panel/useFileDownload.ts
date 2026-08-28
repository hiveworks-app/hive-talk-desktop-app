'use client';

import { useState } from 'react';
import { chooseDownloadDirectory, downloadFileFromUrl, downloadFileSilently } from '@/shared/utils/downloadFile';
import { apiGetStorage } from '@/features/storage/api';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useUIStore } from '@/store/uiStore';

export interface BulkDownloadItem {
  /** 목록에 담겨온 presigned URL — 곧 만료되므로 fallback으로만 쓴다 */
  url?: string;
  /** NCP 스토리지 키 — 다운로드 직전 fresh presigned URL 재발급용 (뷰어와 동일 패턴) */
  storageKey?: string;
  filename: string;
}

/** 목록의 presigned URL은 발급 후 곧 만료된다 — 다운로드 직전에 키로 재발급 (실패 시 목록 URL 폴백) */
async function resolveFreshUrl(storageKey?: string, fallback?: string): Promise<string | undefined> {
  if (storageKey) {
    try {
      const res = await apiGetStorage(storageKey);
      return res.payload.key;
    } catch {
      // 재발급 실패 — 목록 URL이 아직 살아있을 수 있으니 폴백
    }
  }
  return fallback;
}

/**
 * 사이드패널 파일/미디어 다운로드 훅 (개별 + 일괄).
 * 다운로드 중인 항목 id / 일괄 진행 여부를 노출해 호출부가 스피너·비활성화를 표시한다.
 */
export function useFileDownload() {
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const download = async (id: string, url: string | undefined, filename: string, storageKey?: string) => {
    if (downloadingId || bulkDownloading) return; // 동시 다운로드 제한
    if (isOffline()) return;

    setDownloadingId(id);
    try {
      const freshUrl = await resolveFreshUrl(storageKey, url);
      if (!freshUrl) {
        showSnackbar({ message: '다운로드 주소를 찾을 수 없습니다.', state: 'error' });
        return;
      }
      await downloadFileFromUrl(freshUrl, filename);
    } catch {
      showSnackbar({ message: '다운로드에 실패했습니다.', state: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * 선택 항목 일괄 다운로드 — 저장 폴더를 먼저 물어본 뒤 순차 저장 (Electron). 웹은 anchor 폴백.
   * 성공 개수를 반환한다 — 호출부는 1건 이상 성공 시에만 선택 모드를 해제한다 (RN onDownloadComplete 조건).
   * null 은 다운로드가 시작조차 안 된 경우 (중복 호출·오프라인·폴더 선택 취소) — 선택 유지.
   */
  const downloadMany = async (items: BulkDownloadItem[]): Promise<number | null> => {
    if (bulkDownloading || downloadingId || items.length === 0) return null;
    if (isOffline()) return null;

    // 데스크톱 관례 — 어디에 저장할지 먼저 묻는다 (취소하면 아무 것도 받지 않음)
    const directory = await chooseDownloadDirectory();
    if (directory === null) return null; // 사용자 취소

    setBulkDownloading(true);
    let failed = 0;
    for (const item of items) {
      try {
        const freshUrl = await resolveFreshUrl(item.storageKey, item.url);
        if (!freshUrl) {
          failed++;
          continue;
        }
        // Electron: main 프로세스가 선택 폴더에 순차 저장(완료까지 대기) / 웹: anchor 폴백(간격 250ms)
        await downloadFileSilently(freshUrl, item.filename, directory);
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch {
        failed++;
      }
    }
    setBulkDownloading(false);

    const ok = items.length - failed;
    if (failed === 0) {
      showSnackbar({ message: `${ok}개를 저장했어요.`, state: 'success' });
    } else if (ok === 0) {
      showSnackbar({ message: '다운로드에 실패했습니다.', state: 'error' });
    } else {
      showSnackbar({ message: `${ok}개 저장, ${failed}개 실패`, state: 'warning' });
    }
    return ok;
  };

  return { download, downloadingId, downloadMany, bulkDownloading };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetStorage } from '@/features/storage/api';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { chooseDownloadDirectory, downloadFileSilently } from '@/shared/utils/downloadFile';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useUIStore } from '@/store/uiStore';
import type { MediaViewerItem } from './MediaViewer';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

const INITIAL_VIEW: ViewState = { scale: 1, tx: 0, ty: 0 };

/** HiveTalk_Photo_2026-08-27-11-30-00 형식 — 단건 저장 파일명과 동일 규칙 */
function buildDownloadBaseName(type: 'image' | 'video'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `HiveTalk_${type === 'video' ? 'Video' : 'Photo'}_${ts}`;
}

function extractExt(item: MediaViewerItem): string {
  const source = item.storageKey || item.url;
  return ((source.split('/').pop()?.split('?')[0] || '').split('.').pop() || '')
    || (item.type === 'video' ? 'mp4' : 'jpg');
}

export function useMediaViewerControls(
  items: MediaViewerItem[],
  currentIndex: number,
  onIndexChange: (index: number) => void,
  onClose: () => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const item = items[currentIndex];
  const { data: freshUrl, refetch: refetchUrl, fetchStatus } = usePresignedUrl(item?.storageKey);
  const isFetchingUrl = item?.storageKey ? fetchStatus === 'fetching' : false;
  const displayUrl = freshUrl || item?.url || '';
  const retryCountRef = useRef(0);

  // URL 변경 시 상태 리셋
  const prevUrlRef = useRef(displayUrl);
  if (prevUrlRef.current !== displayUrl) {
    prevUrlRef.current = displayUrl;
    if (hasError) setHasError(false);
    if (!isLoading) setIsLoading(true);
  }

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;
  const isZoomed = view.scale > 1;

  const resetView = useCallback(() => setView(INITIAL_VIEW), []);

  const navigateTo = useCallback((index: number) => {
    onIndexChange(index);
    setView(INITIAL_VIEW);
    setIsLoading(true);
    setHasError(false);
    retryCountRef.current = 0;
  }, [onIndexChange]);

  const goPrev = useCallback(() => { if (hasPrev) navigateTo(currentIndex - 1); }, [hasPrev, currentIndex, navigateTo]);
  const goNext = useCallback(() => { if (hasNext) navigateTo(currentIndex + 1); }, [hasNext, currentIndex, navigateTo]);

  // Keyboard navigation — capture 단계에서 먼저 받아 ESC를 소비(preventDefault)한다.
  // 아래층 풀스크린 오버레이(프로필 등)는 defaultPrevented를 보고 무시 → 뷰어만 닫힘.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.stopPropagation();
          e.preventDefault();
          if (isZoomed) resetView();
          else onClose();
          break;
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [onClose, goPrev, goNext, isZoomed, resetView]);

  // Pause video on navigate
  useEffect(() => { if (videoRef.current) videoRef.current.pause(); }, [currentIndex]);

  // Prevent body scroll + ESC 억제 (참조 카운터 — 프로필 오버레이 등과 중첩 안전)
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const release = acquireEscSuppress();
    return () => { document.body.style.overflow = ''; release(); };
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (item?.type !== 'image') return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setView(prev => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta));
        return nextScale <= MIN_SCALE ? INITIAL_VIEW : { ...prev, scale: nextScale };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [item?.type]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item?.type !== 'image') return;
    setView(prev => (prev.scale > 1 ? INITIAL_VIEW : { scale: 2, tx: 0, ty: 0 }));
  }, [item?.type]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (view.scale <= 1 || item?.type !== 'image') return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startTx = view.tx, startTy = view.ty;
    const onMove = (me: MouseEvent) => {
      setView(prev => ({ ...prev, tx: startTx + (me.clientX - startX) / prev.scale, ty: startTy + (me.clientY - startY) / prev.scale }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [view.scale, view.tx, view.ty, item?.type]);

  const handleDownload = useCallback(async () => {
    if (!displayUrl) return;
    try {
      const res = await fetch(displayUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${buildDownloadBaseName(item.type)}.${extractExt(item)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(displayUrl, '_blank');
    }
  }, [displayUrl, item]);

  const handleMediaError = useCallback(() => {
    if (item?.storageKey && retryCountRef.current < 2) {
      retryCountRef.current += 1;
      refetchUrl();
    } else {
      setHasError(true);
    }
  }, [item?.storageKey, refetchUrl]);

  // 묶음(같은 메시지) 항목들 — 2개 이상이면 다운로드 버튼이 '전체 저장/이 사진만' 메뉴가 된다 (RN 액션시트 패리티)
  const bundleItems = item?.bundleId ? items.filter(i => i.bundleId === item.bundleId) : [];
  const [isBundleDownloading, setIsBundleDownloading] = useState(false);

  /** 묶음 전체 저장 — 사이드패널 일괄 다운로드와 동일 관례: 저장 폴더 선택 → 순차 저장 → 스낵바 요약 */
  const handleDownloadBundle = useCallback(async () => {
    if (isBundleDownloading || bundleItems.length < 2) return;
    if (isOffline()) return;

    // 데스크톱 관례 — 어디에 저장할지 먼저 묻는다 (취소하면 아무 것도 받지 않음)
    const directory = await chooseDownloadDirectory();
    if (directory === null) return; // 사용자 취소

    setIsBundleDownloading(true);
    const baseName = buildDownloadBaseName('image');
    let failed = 0;
    for (let i = 0; i < bundleItems.length; i++) {
      const target = bundleItems[i];
      try {
        // 목록 presigned URL은 만료됐을 수 있다 — 키로 재발급 후 실패 시 목록 URL 폴백 (사이드패널과 동일)
        let url = target.url;
        if (target.storageKey) {
          try {
            url = (await apiGetStorage(target.storageKey)).payload.key;
          } catch { /* 재발급 실패 — 목록 URL 폴백 */ }
        }
        if (!url) { failed++; continue; }
        await downloadFileSilently(url, `${baseName}_${i + 1}.${extractExt(target)}`, directory);
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch {
        failed++;
      }
    }
    setIsBundleDownloading(false);

    const ok = bundleItems.length - failed;
    const showSnackbar = useUIStore.getState().showSnackbar;
    if (failed === 0) {
      showSnackbar({ message: `사진 ${ok}장을 저장했어요.`, state: 'success' });
    } else if (ok === 0) {
      showSnackbar({ message: '다운로드에 실패했습니다.', state: 'error' });
    } else {
      showSnackbar({ message: `${ok}장 저장, ${failed}장 실패`, state: 'warning' });
    }
  }, [isBundleDownloading, bundleItems]);

  return {
    videoRef, contentRef,
    view, isLoading, setIsLoading, hasError, isFetchingUrl,
    item, displayUrl,
    hasPrev, hasNext, isZoomed,
    goPrev, goNext,
    handleDoubleClick, handleMouseDown, handleDownload, handleMediaError,
    bundleItems, isBundleDownloading, handleDownloadBundle,
  };
}

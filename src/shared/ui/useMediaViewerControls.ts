'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
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

  // Keyboard navigation
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
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext, isZoomed, resetView]);

  // Pause video on navigate
  useEffect(() => { if (videoRef.current) videoRef.current.pause(); }, [currentIndex]);

  // Prevent body scroll + ESC 억제
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const api = (window as unknown as { electronAPI?: { setSuppressEsc?: (v: boolean) => void } }).electronAPI;
    api?.setSuppressEsc?.(true);
    return () => { document.body.style.overflow = ''; api?.setSuppressEsc?.(false); };
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
      const ext = ((item.storageKey || displayUrl).split('/').pop()?.split('?')[0] || '').split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      a.download = `HiveTalk_${item.type === 'video' ? 'Video' : 'Photo'}_${ts}.${ext}`;
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

  return {
    videoRef, contentRef,
    view, isLoading, setIsLoading, hasError, isFetchingUrl,
    item, displayUrl,
    hasPrev, hasNext, isZoomed,
    goPrev, goNext,
    handleDoubleClick, handleMouseDown, handleDownload, handleMediaError,
  };
}

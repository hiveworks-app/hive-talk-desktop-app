'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  storageKey?: string;
  author?: string;
}

interface MediaViewerProps {
  visible: boolean;
  items: MediaViewerItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Outer shell: dimmed 관리 + visible 가드. 닫힐 때 Inner가 unmount → state 자동 리셋 */
export function MediaViewer(props: MediaViewerProps) {
  useDimmed(props.visible);
  if (!props.visible || !props.items[props.currentIndex]) return null;
  return <MediaViewerContent {...props} />;
}

/* ─── Constants ─── */

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

const INITIAL_VIEW: ViewState = { scale: 1, tx: 0, ty: 0 };

/* ─── Inner Content (unmount 시 state 자동 리셋) ─── */

function MediaViewerContent({
  items,
  currentIndex,
  onIndexChange,
  onClose,
}: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const item = items[currentIndex];

  // storageKey가 있으면 fresh presigned URL 조회 (만료 자동 갱신)
  const { data: freshUrl, refetch: refetchUrl, fetchStatus } = usePresignedUrl(item?.storageKey);
  const isFetchingUrl = item?.storageKey ? fetchStatus === 'fetching' : false;
  const displayUrl = freshUrl || item?.url || '';
  const retryCountRef = useRef(0);

  // URL 변경 시 에러/로딩 상태 리셋 → 새 URL로 재시도
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

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      resetView();
      setIsLoading(true);
      setHasError(false);
      retryCountRef.current = 0;
    }
  }, [currentIndex, onIndexChange, resetView]);

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      onIndexChange(currentIndex + 1);
      resetView();
      setIsLoading(true);
      setHasError(false);
      retryCountRef.current = 0;
    }
  }, [currentIndex, items.length, onIndexChange, resetView]);

  /* ── Keyboard navigation ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.stopPropagation();
          e.preventDefault();
          if (isZoomed) resetView();
          else onClose();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext, isZoomed, resetView]);

  /* ── Pause video on navigate ── */
  useEffect(() => {
    if (videoRef.current) videoRef.current.pause();
  }, [currentIndex]);

  /* ── Prevent body scroll + ESC 억제 (Electron) ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const api = (window as unknown as { electronAPI?: { setSuppressEsc?: (v: boolean) => void } }).electronAPI;
    api?.setSuppressEsc?.(true);
    return () => {
      document.body.style.overflow = '';
      api?.setSuppressEsc?.(false);
    };
  }, []);

  /* ── Wheel zoom (non-passive for preventDefault) ── */
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

  /* ── Double click zoom toggle ── */
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item?.type !== 'image') return;
    setView(prev => (prev.scale > 1 ? INITIAL_VIEW : { scale: 2, tx: 0, ty: 0 }));
  }, [item?.type]);

  /* ── Mouse drag for pan ── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (view.scale <= 1 || item?.type !== 'image') return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startTx = view.tx;
      const startTy = view.ty;

      const onMove = (me: MouseEvent) => {
        setView(prev => ({
          ...prev,
          tx: startTx + (me.clientX - startX) / prev.scale,
          ty: startTy + (me.clientY - startY) / prev.scale,
        }));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [view.scale, view.tx, view.ty, item?.type],
  );

  /* ── Download ── */
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
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      a.download = `HiveTalk_${item.type === 'video' ? 'Video' : 'Photo'}_${timestamp}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(displayUrl, '_blank');
    }
  }, [displayUrl]);

  if (!item) return null;

  return (
    <div className="electron-fixed-safe-top fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* ── Header ── */}
      <div className="relative flex items-center justify-between px-4 py-3">
        {/* Close (left) */}
        <button
          onClick={onClose}
          className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Author + Index (center) */}
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          {item.author && <span className="text-sub font-medium text-white/90">{item.author}</span>}
          {items.length > 1 && (
            <span className="text-caption text-white/50">
              {currentIndex + 1} / {items.length}
            </span>
          )}
        </div>

        {/* Download (right) */}
        <button
          onClick={handleDownload}
          className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {/* ── Content ── */}
      <div
        ref={contentRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        {/* Previous */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Media */}
        <div className="flex h-full w-full items-center justify-center p-8">
          {hasError ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-sub">이미지를 불러올 수 없습니다</span>
            </div>
          ) : isFetchingUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            </div>
          ) : item.type === 'image' ? (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
              )}
              <img
                key={displayUrl}
                src={displayUrl}
                alt=""
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `scale(${view.scale}) translate(${view.tx}px, ${view.ty}px)`,
                  cursor: isZoomed ? 'grab' : 'default',
                  opacity: isLoading ? 0 : 1,
                  transition: 'opacity 0.2s',
                }}
                draggable={false}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  if (item.storageKey && retryCountRef.current < 2) {
                    retryCountRef.current += 1;
                    refetchUrl();
                  } else {
                    setHasError(true);
                  }
                }}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
              />
            </>
          ) : (
            <video
              key={displayUrl}
              ref={videoRef}
              src={displayUrl}
              controls
              autoPlay
              className="max-h-full max-w-full"
              onClick={e => e.stopPropagation()}
              onError={() => {
                if (item.storageKey && retryCountRef.current < 2) {
                  retryCountRef.current += 1;
                  refetchUrl();
                } else {
                  setHasError(true);
                }
              }}
            />
          )}
        </div>

        {/* Next */}
        {hasNext && (
          <button
            onClick={goNext}
            className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

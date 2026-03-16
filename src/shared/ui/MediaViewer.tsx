'use client';

import { useDimmed } from '@/shared/hooks/useDimmed';
import { useMediaViewerControls } from './useMediaViewerControls';

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

/** Outer shell: dimmed 관리 + visible 가드 */
export function MediaViewer(props: MediaViewerProps) {
  useDimmed(props.visible);
  if (!props.visible || !props.items[props.currentIndex]) return null;
  return <MediaViewerContent {...props} />;
}

function MediaViewerContent({ items, currentIndex, onIndexChange, onClose }: MediaViewerProps) {
  const {
    videoRef, contentRef,
    view, isLoading, setIsLoading, hasError, isFetchingUrl,
    item, displayUrl,
    hasPrev, hasNext, isZoomed,
    goPrev, goNext,
    handleDoubleClick, handleMouseDown, handleDownload, handleMediaError,
  } = useMediaViewerControls(items, currentIndex, onIndexChange, onClose);

  if (!item) return null;

  return (
    <div className="electron-fixed-safe-top fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          {item.author && <span className="text-sub font-medium text-white/90">{item.author}</span>}
          {items.length > 1 && <span className="text-caption text-white/50">{currentIndex + 1} / {items.length}</span>}
        </div>
        <button onClick={handleDownload} className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {hasPrev && (
          <button onClick={goPrev} className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center p-8">
          {hasError ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
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
                onError={handleMediaError}
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
              onError={handleMediaError}
            />
          )}
        </div>

        {hasNext && (
          <button onClick={goNext} className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

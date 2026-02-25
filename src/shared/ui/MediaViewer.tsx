'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  author?: string;
}

interface MediaViewerProps {
  visible: boolean;
  items: MediaViewerItem[];
  initialIndex: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function MediaViewer({
  visible,
  items,
  initialIndex,
  currentIndex,
  onIndexChange,
  onClose,
}: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const item = items[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) onIndexChange(currentIndex + 1);
  }, [currentIndex, items.length, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
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
  }, [visible, onClose, goPrev, goNext]);

  // Pause video when navigating away
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [currentIndex]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  if (!visible || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {item.author && (
            <span className="text-sm text-white/80">{item.author}</span>
          )}
          {items.length > 1 && (
            <span className="text-sm text-white/60">
              {currentIndex + 1} / {items.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Previous button */}
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

        {/* Media content */}
        <div className="flex h-full w-full items-center justify-center p-8">
          {item.type === 'image' ? (
            <img
              key={item.id}
              src={item.url}
              alt=""
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          ) : (
            <video
              key={item.id}
              ref={videoRef}
              src={item.url}
              controls
              autoPlay
              className="max-h-full max-w-full"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>

        {/* Next button */}
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

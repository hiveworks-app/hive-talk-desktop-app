'use client';

import { useEffect } from 'react';
import { formatBytes } from '@/shared/utils/fileUtils';

export interface PendingFileItem {
  file: File;
  previewUrl: string | null;
}

interface FileConfirmDialogProps {
  items: PendingFileItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function FileConfirmDialog({ items, onConfirm, onCancel }: FileConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="border-b border-divider px-5 py-4">
          <h3 className="text-heading-sm font-bold text-text-primary">파일 전송</h3>
        </div>

        {/* 파일 목록 */}
        <div className="max-h-80 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : item.file.type.startsWith('video/') ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-text-tertiary">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sub font-medium text-text-primary">
                    {item.file.name}
                  </p>
                  <p className="text-caption text-text-tertiary">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 border-t border-divider px-5 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-divider py-1.5 text-sub font-medium text-text-secondary transition-colors hover:bg-surface-pressed"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-primary py-1.5 text-sub font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)]"
          >
            {items.length}개 전송
          </button>
        </div>
      </div>
    </div>
  );
}

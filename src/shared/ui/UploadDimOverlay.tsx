'use client';

import { useUploadProgressStore } from '@/store/chat/uploadProgressStore';

interface UploadDimOverlayProps {
  fileId?: string;
  dimmed?: boolean;
}

export function UploadDimOverlay({ fileId, dimmed }: UploadDimOverlayProps) {
  const progress = useUploadProgressStore(s => (fileId ? s.byFileId[fileId] : undefined));

  if (!dimmed) return null;

  const label = progress && progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/30">
      {/* CSS Spinner */}
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      {label && (
        <span className="mt-1.5 text-sub-sm font-medium text-white drop-shadow">{label}</span>
      )}
    </div>
  );
}

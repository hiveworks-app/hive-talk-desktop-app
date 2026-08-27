'use client';

import { useUploadProgressStore } from '@/store/chat/uploadProgressStore';

interface UploadDimOverlayProps {
  fileId?: string;
  dimmed?: boolean;
  /** 실패 상태 — dim만 유지하고 스피너·진행률·취소 X는 숨긴다 (재전송/삭제 버튼과 중복 표시 방지) */
  failed?: boolean;
  /** 업로드 중 취소 (전송대기중 X — 정책 chat-room.md, RN 패리티). 없으면 X 미표시. */
  onCancel?: () => void;
}

export function UploadDimOverlay({ fileId, dimmed, failed, onCancel }: UploadDimOverlayProps) {
  const progress = useUploadProgressStore(s => (fileId ? s.byFileId[fileId] : undefined));

  if (!dimmed) return null;

  // 실패한 버블은 "전송 중" 표식(스피너/카운터)을 함께 그리면 안 된다 (2026-08-27 QA)
  if (failed) return <div className="absolute inset-0 rounded-lg bg-black/30" />;

  const label = progress && progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/30">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="업로드 취소"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70 active:opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      )}
      {/* CSS Spinner */}
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      {label && (
        <span className="mt-1.5 text-sub-sm font-medium text-white drop-shadow">{label}</span>
      )}
    </div>
  );
}

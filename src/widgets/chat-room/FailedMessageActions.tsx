'use client';

import { IconDelete, IconErrorOutline, IconRefresh } from '@/shared/ui/icons';

interface FailedMessageActionsProps {
  onRetry: () => void;
  onDelete: () => void;
}

export function FailedMessageActions({ onRetry, onDelete }: FailedMessageActionsProps) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <IconErrorOutline size={12} className="text-[#F04452]" />
      <div className="flex gap-1.5">
        <button
          onClick={onRetry}
          className="flex items-center gap-0.5 text-[10px] font-medium text-primary hover:opacity-70"
        >
          <IconRefresh size={10} />
          재시도
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-0.5 text-[10px] font-medium text-[#F04452] hover:opacity-70"
        >
          <IconDelete size={10} />
          삭제
        </button>
      </div>
    </div>
  );
}

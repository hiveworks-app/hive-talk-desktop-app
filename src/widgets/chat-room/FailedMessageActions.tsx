'use client';

import IconMessageDelete from '@assets/icons/message-delete.svg';
import IconMessageResend from '@assets/icons/message-resend.svg';

interface FailedMessageActionsProps {
  onRetry: () => void;
  onDelete: () => void;
}

/**
 * 전송 실패 액션 — RN FailedActionColumn 패리티.
 * 흰 박스 + gray-200 테두리(5px) 안에 재전송(gray-700)·삭제(빨강) 아이콘 2셀.
 * RN은 탭 시 액션시트지만 데스크톱은 각 아이콘을 직접 클릭한다.
 */
export function FailedMessageActions({ onRetry, onDelete }: FailedMessageActionsProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-[5px] border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onRetry}
        aria-label="메시지 재전송"
        className="flex size-5 items-center justify-center transition-colors active:bg-gray-200"
      >
        <IconMessageResend width={16} height={16} className="text-gray-700" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="메시지 삭제"
        className="flex size-5 items-center justify-center transition-colors active:bg-gray-200"
      >
        <IconMessageDelete width={16} height={16} className="text-state-error" />
      </button>
    </div>
  );
}

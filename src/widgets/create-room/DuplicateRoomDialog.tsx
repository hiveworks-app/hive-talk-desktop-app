'use client';

import { useDimmed } from '@/shared/hooks/useDimmed';
import { useEscClose } from '@/shared/hooks/useEscClose';

interface DuplicateRoomDialogProps {
  open: boolean;
  /** 선택한 멤버 이름들 (안내 문구에 표시). */
  memberNames: string[];
  /** "새로운 채팅방 만들기" — 중복 무시하고 새 방 생성(Step2)으로. */
  onCreateNew: () => void;
  /** "기존 채팅방으로 이동" — 중복된 기존 방으로 입장. */
  onGoExisting: () => void;
  /** 딤 클릭 등 닫기 (Step1 유지). */
  onClose: () => void;
}

/**
 * 중복 채팅방 생성 안내 — 선택한 멤버 조합과 동일한 협력방이 이미 있을 때 표시.
 * RN(Figma 2709-52657)은 하단 바텀시트지만 데스크톱 관례에 맞게 중앙 모달로.
 * 카피·버튼 구성은 동일 (생성 다이얼로그 z-50 위 z-[60]).
 */
export function DuplicateRoomDialog({
  open,
  memberNames,
  onCreateNew,
  onGoExisting,
  onClose,
}: DuplicateRoomDialogProps) {
  useDimmed(open);
  // ESC = 딤 클릭과 동일(닫기, Step1 유지) — 생성 다이얼로그 위 겹침은 스택이 최상단만 닫는다
  useEscClose(open, onClose);
  if (!open) return null;

  return (
    <div className="electron-no-drag fixed inset-0 z-[60] flex items-center justify-center">
      <div className="animate-fade-in-fast absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="animate-pop-in relative z-10 flex w-[360px] max-w-[90vw] flex-col gap-3.5 rounded-xl bg-white p-6">
        <div className="flex flex-col gap-2">
          <p className="text-body font-semibold text-text-primary">중복 채팅방 생성 안내</p>
          <p className="text-heading-md font-semibold text-text-primary">
            {memberNames.join(',')} <span className="text-gray-400">{memberNames.length}</span>
          </p>
          <p className="text-label text-gray-700">선택한 친구들로 구성된 채팅방이 이미있어요.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCreateNew}
            className="flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-gray-100 px-4 text-body font-medium text-text-secondary transition-colors hover:bg-gray-200"
          >
            새로운 채팅방 만들기
          </button>
          <button
            onClick={onGoExisting}
            className="flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 text-body font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            기존 채팅방으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

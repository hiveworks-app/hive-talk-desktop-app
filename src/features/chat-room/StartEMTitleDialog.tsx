'use client';

import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import type { EMTitleDraft } from './useStartMemberChat';

interface StartEMTitleDialogProps {
  draft: EMTitleDraft | null;
  onChangeTitle: (title: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 협력멤버 1:1 EM 생성 — 방 제목 입력 다이얼로그 (useStartMemberChat 짝, RN 제목 입력 화면 대응) */
export function StartEMTitleDialog({ draft, onChangeTitle, onConfirm, onCancel }: StartEMTitleDialogProps) {
  if (!draft) return null;
  return (
    <ConfirmDialog
      open
      title="협력채팅 방 제목"
      description={
        <input
          type="text"
          value={draft.title}
          onChange={e => onChangeTitle(e.target.value.slice(0, 50))}
          placeholder="방 제목을 입력해주세요 (1~50자)"
          className="mt-1 h-10 w-full rounded-lg border border-outline px-3 text-sub text-text-primary outline-none focus:border-primary"
        />
      }
      confirmLabel="만들기"
      cancelLabel="취소"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

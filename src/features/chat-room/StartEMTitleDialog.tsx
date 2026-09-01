'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { GroupProfileAvatar } from '@/shared/ui/GroupProfileAvatar';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { DuplicateRoomDialog } from '@/widgets/create-room/DuplicateRoomDialog';
import type { EMDuplicate, EMTitleDraft } from './useStartMemberChat';

const MAX_TITLE = 50;

interface StartEMTitleDialogProps {
  draft: EMTitleDraft | null;
  onChangeTitle: (title: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** 중복 방 발견 상태 — [새로 만들기/기존 방 이동] 선택 (RN DuplicateRoomBottomSheet 패리티) */
  duplicate?: EMDuplicate | null;
  onDuplicateCreateNew?: () => void;
  onDuplicateGoExisting?: () => void;
  onDuplicateClose?: () => void;
}

/**
 * 협력멤버 1:1 EM 생성 — 채팅방 정보 설정 모달 (useStartMemberChat 짝).
 *
 * RN CreateExternalRoomInfoScreen 패리티: 아바타 + "채팅방 이름 (필수)" + 글자수 카운터 +
 * 안내 박스 — 새 협력채팅 다이얼로그 Step2와 동일 구성으로, 1:1이라고 간소화하지 않는다
 * (기존 간이 컨펌창은 RN 대비 축약이었음 — 2026-09-01 QA).
 * 제목은 비워 시작하고 placeholder로 상대 이름을 보여준다 (입력 전 [확인] 비활성, RN 동일).
 */
export function StartEMTitleDialog({
  draft,
  onChangeTitle,
  onConfirm,
  onCancel,
  duplicate,
  onDuplicateCreateNew,
  onDuplicateGoExisting,
  onDuplicateClose,
}: StartEMTitleDialogProps) {
  // 스크림이 창 전체(타이틀바 대역 포함)를 덮는 동안 WCO 버튼 dim 동기화
  useDimmed(!!draft);

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // ESC = 취소 + Electron 창 숨김 억제 (다른 풀스크린 모달과 동일 규칙)
  const isOpen = !!draft;
  useEffect(() => {
    if (!isOpen) return;
    const release = acquireEscSuppress();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onCancelRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      release();
    };
  }, [isOpen]);

  // 중복 안내 — 제목 폼과 배타적으로 뜬다 (훅이 상태 전이를 관리)
  const duplicateDialog = (
    <DuplicateRoomDialog
      open={!!duplicate}
      memberNames={duplicate ? [duplicate.member.name] : []}
      onCreateNew={onDuplicateCreateNew ?? (() => {})}
      onGoExisting={onDuplicateGoExisting ?? (() => {})}
      onClose={onDuplicateClose ?? (() => {})}
    />
  );

  if (!draft) return duplicateDialog;

  const canConfirm = draft.title.trim().length > 0;

  return createPortal(
    // electron-no-drag: 상단 드래그 스트립이 스크림 상단 클릭을 창 이동으로 삼키지 않게
    <div
      className="electron-no-drag fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="animate-fade-in-fast absolute inset-0 bg-black/30" />

      <div
        className="animate-pop-in relative z-10 w-[400px] max-w-full rounded-2xl bg-white px-4 pb-6 pt-3 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더: X / 채팅방 정보 설정 / 확인 (RN ScreenHeader 대응) */}
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-text-primary transition-colors hover:bg-outline"
          >
            <IconCloseStroke width={16} height={16} />
          </button>
          <p className="flex-1 text-center text-body font-semibold text-text-primary">채팅방 정보 설정</p>
          <button
            type="submit"
            form="start-em-title-form"
            disabled={!canConfirm}
            className="px-1 text-heading-sm font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-text-tertiary"
          >
            확인
          </button>
        </div>

        <form
          id="start-em-title-form"
          onSubmit={e => {
            e.preventDefault();
            if (canConfirm) onConfirm();
          }}
          className="flex flex-col items-center gap-3.5 pt-4"
        >
          {/* 상대 아바타 (RN GroupProfileAvatar 패리티) */}
          <GroupProfileAvatar
            size="lg"
            users={[{ name: draft.member.name, storageKey: draft.member.profileUrl }]}
          />

          {/* 채팅방 이름 (필수) — placeholder는 상대 이름 (RN buildChatRoomTitlePlaceholder 대응) */}
          <div className="flex w-full flex-col gap-1">
            <label className="text-sub-sm text-text-primary">채팅방 이름 (필수)</label>
            <input
              autoFocus
              type="text"
              value={draft.title}
              onChange={e => onChangeTitle(e.target.value.slice(0, MAX_TITLE))}
              maxLength={MAX_TITLE}
              placeholder={draft.member.name}
              className="h-9 w-full rounded-lg border border-divider bg-white px-4 text-sub text-text-primary outline-none transition placeholder:truncate placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
            />
            <span className="text-right text-sub-sm text-text-tertiary">{draft.title.length}/{MAX_TITLE}</span>
          </div>

          {/* 안내 (RN 동일 문구) */}
          <div className="w-full rounded-xl bg-gray-100 px-2.5 py-1.5">
            <p className="text-sub-sm text-gray-700">
              채팅시작 전, 설정한 채팅방 이름은 모든 대화상대에게 동일하게 적용돼요.
            </p>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

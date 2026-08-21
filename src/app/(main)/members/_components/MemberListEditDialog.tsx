'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { comparePolicyMemberName } from '@/features/members/policySort';
import { useMemberListEditController } from '@/features/pinned-members/useMemberListEditController';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { cn } from '@/shared/lib/cn';
import { acquireEscSuppress } from '@/shared/utils/escSuppress';
import { pushOverlay } from '@/shared/utils/overlayStack';
import type { MemberItem } from '@/shared/types/user';
import { Checkbox } from '@/shared/ui/Checkbox';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { useUIStore } from '@/store/uiStore';
import IconDragHandle from '@assets/icons/drag-handle.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';

interface MemberListEditDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 멤버목록 편집 — 관심멤버 드래그 정렬 + 일괄 등록/해제 (RN MemberListEditScreen 대응).
 * 풀스크린 오버레이 패턴 (채팅방 관리와 동일). 드래그는 HTML5 DnD로 대응.
 *
 * - 관심멤버 섹션: 우측 ≡ 핸들 드래그로 순서 변경, [해제] 버튼으로 즉시 해제(DELETE)
 * - 전체멤버 섹션: 체크로 신규 선택 → 하단 CTA로 일괄 등록(PUT)
 * - [완료]: 순서 변경이 있으면 PUT 저장 후 닫힘
 */
export function MemberListEditDialog({ open, onClose }: MemberListEditDialogProps) {
  useDimmed(open);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const {
    isLoading,
    pinnedMembers,
    allMembers,
    isChecked,
    isPinned,
    toggleNewSelection,
    removePinned,
    reorderPinned,
    saveOrder,
    deselectNewSelections,
    save,
    isSaving,
    pinnedCount,
    totalCount,
    newSelectionCount,
    hasNewSelections,
  } = useMemberListEditController();

  // HTML5 DnD 리오더 (RN DraggableList 대응)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const handleDragOverRow = (overIndex: number) => {
    if (dragIndex === null || dragIndex === overIndex) return;
    const next = [...pinnedMembers];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    reorderPinned(next);
    setDragIndex(overIndex);
  };

  // 관심멤버 해제 — 연타 방어 (RN removePinnedInFlightRef 패리티)
  const removeInFlightRef = useRef(false);
  const handleRemovePinned = async (userId: string) => {
    if (removeInFlightRef.current) return;
    removeInFlightRef.current = true;
    try {
      await removePinned(userId);
      showSnackbar({ message: '관심멤버가 해제되었어요.', state: 'success' });
    } catch {
      showSnackbar({ message: '관심멤버 해제에 실패했어요.', state: 'error' });
    } finally {
      removeInFlightRef.current = false;
    }
  };

  // 완료 — 순서 변경이 있으면 PUT 저장 후 닫힘 (RN handleClose 패리티)
  const handleDone = async () => {
    try {
      await saveOrder();
    } catch {
      showSnackbar({ message: '순서 변경 저장에 실패했어요.', state: 'error' });
      return;
    }
    onClose();
  };

  // CTA — 새 선택 일괄 등록 (RN handleCtaPress 패리티)
  const handleRegister = async () => {
    if (!hasNewSelections || isSaving) return;
    try {
      await save();
      showSnackbar({ message: '관심멤버로 지정되었어요.', state: 'success' });
    } catch {
      showSnackbar({ message: '관심멤버 등록에 실패했어요.', state: 'error' });
    }
  };

  // ESC로도 완료 동작 (데스크톱 관례 — 순서 변경분 저장 후 닫힘).
  // Electron 메인의 ESC→창 숨김(before-input-event)은 열려 있는 동안 참조 카운터로 억제.
  // 위에 뜬 뷰어 등이 소비한(preventDefault) ESC는 무시한다.
  useEffect(() => {
    if (!open) return;
    // 오버레이 스택 편입 — ESC 최상단 판별 + 전역 단축키(⌘F) 가드(hasOpenOverlay)에 포함
    const overlay = pushOverlay();
    const release = acquireEscSuppress();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && overlay.isTop()) void handleDone();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      release();
      overlay.release();
    };
  }, [open, saveOrder]);

  if (!open) return null;

  const sortedAllMembers = [...allMembers].sort((a, b) => comparePolicyMemberName(a.name, b.name));

  // 조상 DOM(헤더 등)의 스타일·스택 컨텍스트 간섭을 원천 배제 — body 직속 포털로 렌더.
  // electron-no-drag: 아래 깔린 페이지 헤더의 창 드래그 영역이 상단 버튼 클릭을 삼키지 않도록.
  // 등장 애니메이션(transform)은 내부 래퍼에만 — no-drag 루트가 움직이면 구멍 위치가 틀어진다.
  return createPortal(
    <div className="electron-no-drag fixed inset-0 z-50">
    <div className="animate-overlay-in flex h-full flex-col bg-gray-50">
      {/* macOS 신호등 영역 확보용 드래그 바 */}
      <div className="electron-drag h-8 w-full shrink-0" />

      {/* 상단바: 완료 | 멤버목록 편집 | N 선택해제 (RN ScreenHeader 패리티) */}
      <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
        <button
          type="button"
          onClick={() => void handleDone()}
          disabled={isSaving}
          className="text-body font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-50"
        >
          완료
        </button>
        <h2 className="text-heading-md font-medium text-gray-900">멤버목록 편집</h2>
        <button
          type="button"
          onClick={deselectNewSelections}
          disabled={!hasNewSelections}
          className={cn(
            'text-body font-medium',
            hasNewSelections ? 'text-gray-900 transition-opacity hover:opacity-70 active:opacity-60' : 'text-gray-500',
          )}
        >
          {hasNewSelections ? `${newSelectionCount} 선택해제` : '선택해제'}
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sub text-text-tertiary">로딩 중...</span>
          </div>
        ) : pinnedCount === 0 && totalCount === 0 ? (
          <EmptyState message="아직 함께할 멤버가 없어요." className="flex-1" />
        ) : (
          <div className="scrollbar-thin flex-1 overflow-y-auto pb-24">
            {/* ─── 관심멤버 섹션 (있을 때만) ─── */}
            {pinnedCount > 0 && (
              <div className="border-b border-divider pb-1.5">
                <div className="flex items-center gap-1 px-4 pb-1.5 pt-3.5">
                  <IconStarFilled width={20} height={20} className="text-[#FFD900]" />
                  <span className="text-sub-sm text-text-secondary">관심멤버 ({pinnedCount})</span>
                </div>
                {pinnedMembers.map((member, index) => (
                  <PinnedEditRow
                    key={member.userId}
                    member={member}
                    isDragging={dragIndex === index}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={() => handleDragOverRow(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onRemove={() => void handleRemovePinned(String(member.userId))}
                  />
                ))}
              </div>
            )}

            {/* ─── 전체멤버 섹션 ─── */}
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-3.5">
                <span className="text-sub-sm text-text-secondary">전체멤버 ({totalCount})</span>
              </div>
            )}
            {sortedAllMembers.map(member => {
              const userId = String(member.userId);
              const pinned = isPinned(userId);
              return (
                <button
                  key={userId}
                  type="button"
                  onClick={() => toggleNewSelection(userId)}
                  disabled={pinned}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors',
                    pinned ? 'opacity-50' : 'hover:bg-gray-50',
                  )}
                >
                  <Checkbox checked={isChecked(userId)} size="lg" />
                  <ProfileCircle name={member.name} size="sm" storageKey={member.thumbnailProfileUrl || member.profileUrl} />
                  <span className="min-w-0 shrink truncate text-body text-text-primary">
                    {member.name}
                  </span>
                  {member.isExternal && (
                    <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
                  )}
                  {/* 우측 부서·직급 — 이름보다 먼저 잘리는 정책 (RN 패리티) */}
                  {(() => {
                    const description = [member.department, member.job].filter(Boolean).join(' · ');
                    if (!description) return null;
                    return (
                      <span className="ml-auto min-w-[62px] shrink-[999] truncate text-right text-sub-sm text-text-secondary">
                        {description}
                      </span>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 CTA — RN warning 버튼 패리티: 항상 노출, 미선택 시 disabled(gray-400+흰 텍스트) */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={!hasNewSelections || isSaving}
          className={cn(
            'flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] text-body font-medium transition-colors',
            hasNewSelections && !isSaving
              ? 'bg-[#FFED66] text-gray-900 hover:bg-[#FFD900] active:bg-[#FFD900]'
              : 'bg-gray-400 text-white',
          )}
        >
          <IconStarFilled width={20} height={20} className={hasNewSelections && !isSaving ? 'text-gray-900' : 'text-white'} />
          {isSaving ? '등록 중...' : '관심멤버 등록하기'}
        </button>
      </div>
    </div>
    </div>,
    document.body,
  );
}

interface PinnedEditRowProps {
  member: MemberItem;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
}

/** 관심멤버 편집 행 — [프로필+이름(+∞)] · [해제] 버튼 · 우측 드래그 핸들 (RN PinnedMemberEditItem 패리티) */
function PinnedEditRow({ member, isDragging, onDragStart, onDragOver, onDragEnd, onRemove }: PinnedEditRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => {
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-5 px-4 py-2 transition-colors',
        isDragging ? 'bg-gray-100 opacity-70' : 'hover:bg-gray-50',
      )}
    >
      {/* 프로필 + 이름 */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ProfileCircle name={member.name} size="sm" storageKey={member.thumbnailProfileUrl || member.profileUrl} />
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 shrink truncate text-body text-text-primary">{member.name}</span>
          {member.isExternal && (
            <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
          )}
        </div>
      </div>

      {/* 해제 버튼 (RN: border 박스 텍스트 버튼) */}
      <button
        type="button"
        onClick={onRemove}
        className="h-10 shrink-0 rounded-md border border-gray-200 bg-white px-3.5 text-sub font-medium text-text-secondary transition-colors hover:bg-gray-50"
      >
        해제
      </button>

      {/* 드래그 핸들 (RN: 우측 32px gray-400) */}
      <span className="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing" aria-label="순서 변경">
        <IconDragHandle width={32} height={32} />
      </span>
    </div>
  );
}

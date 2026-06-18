'use client';

import { cn } from '@/shared/lib/cn';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { EmptyState } from '@/shared/ui/EmptyState';
import { IconClose } from '@/shared/ui/icons';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { SelectMemberRow } from './SelectMemberRow';
import { useCreateRoom } from './useCreateRoom';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ isOpen, onClose }: CreateRoomDialogProps) {
  useDimmed(isOpen);
  const {
    search, setSearch,
    toggleSelect, isMember,
    gmTitle, setGmTitle,
    pinnedSection, companySection,
    hasAnyMember,
    isLoading,
    count, needsTitle, canSubmit,
    handleSubmit, close,
  } = useCreateRoom(onClose);

  if (!isOpen) return null;

  const noSearchResult = hasAnyMember && pinnedSection.length === 0 && companySection.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative z-10 flex h-[600px] max-h-[85vh] w-full max-w-[420px] flex-col rounded-2xl bg-white shadow-xl">
        {/* 헤더: X / 대화상대 선택 / 확인 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
          <button onClick={close} aria-label="닫기" className="text-gray-500 hover:text-gray-900">
            <IconClose size={20} />
          </button>
          <h2 className="text-base font-bold text-gray-900">대화상대 선택</h2>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'text-sub font-semibold transition-colors',
              canSubmit ? 'text-primary hover:opacity-80' : 'cursor-default text-text-tertiary',
            )}
          >
            확인{count > 0 ? ` (${count})` : ''}
          </button>
        </div>

        {/* 그룹 채팅방 이름 (2명 이상 선택 시) */}
        {needsTitle && (
          <div className="border-b border-gray-100 px-4 py-2.5">
            <input
              type="text"
              value={gmTitle}
              onChange={(e) => setGmTitle(e.target.value)}
              placeholder="그룹 채팅방 이름"
              className="w-full rounded-lg border border-divider bg-gray-50 px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
            />
          </div>
        )}

        {/* 멤버 검색 */}
        <div className="px-4 pt-3.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-divider bg-gray-100 px-3.5 py-2.5">
            <IconSearchDefault width={20} height={20} className="shrink-0 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="멤버 검색"
              className="min-w-0 flex-1 bg-transparent text-sub text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>

        {/* 목록 */}
        <div className="scrollbar-thin mt-3.5 flex-1 overflow-y-auto pb-2">
          {isLoading ? (
            <div className="py-8 text-center text-sub text-text-tertiary">로딩 중...</div>
          ) : !hasAnyMember ? (
            <EmptyState message="아직 함께할 멤버가 없어요." className="py-10" />
          ) : noSearchResult ? (
            <div className="py-8 text-center text-sub-sm text-text-tertiary">검색 결과가 없어요.</div>
          ) : (
            <>
              {pinnedSection.length > 0 && (
                <div className="border-b border-divider pb-1.5">
                  <div className="flex items-center gap-1 px-4 pb-1.5 pt-3.5">
                    <IconStarFilled width={20} height={20} className="text-yellow-300" />
                    <span className="text-sub-sm text-text-secondary">관심멤버 ({pinnedSection.length})</span>
                  </div>
                  {pinnedSection.map((m) => (
                    <SelectMemberRow key={`pinned-${m.userId}`} member={m} selected={isMember(m)} onToggle={() => toggleSelect(String(m.userId))} />
                  ))}
                </div>
              )}
              <div className="flex items-center px-4 pb-1.5 pt-3.5">
                <span className="text-sub-sm text-text-secondary">사내멤버 ({companySection.length})</span>
              </div>
              {companySection.map((m) => (
                <SelectMemberRow key={m.userId} member={m} selected={isMember(m)} onToggle={() => toggleSelect(String(m.userId))} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

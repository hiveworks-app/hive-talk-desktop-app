'use client';

import { cn } from '@/shared/lib/cn';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { IconClose } from '@/shared/ui/icons';
import { MemberRow } from './MemberRow';
import { useCreateRoom } from './useCreateRoom';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ isOpen, onClose }: CreateRoomDialogProps) {
  useDimmed(isOpen);
  const {
    mode, handleModeChange,
    search, setSearch,
    selectedIds, toggleSelect,
    gmTitle, setGmTitle,
    otherMembers, filtered,
    isLoading, isPending,
    canSubmit, handleSubmit,
  } = useCreateRoom(onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] w-full max-w-[440px] flex-col rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-heading-sm font-bold text-text-primary">새 채팅방</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <IconClose size={20} />
          </button>
        </div>

        {/* 모드 탭 */}
        <div className="flex border-b border-divider">
          <button
            onClick={() => handleModeChange('dm')}
            className={cn(
              'flex-1 py-2.5 text-sub font-medium transition-colors',
              mode === 'dm' ? 'border-b-2 border-primary text-primary' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            1:1 채팅
          </button>
          <button
            onClick={() => handleModeChange('gm')}
            className={cn(
              'flex-1 py-2.5 text-sub font-medium transition-colors',
              mode === 'gm' ? 'border-b-2 border-primary text-primary' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            그룹 채팅
          </button>
        </div>

        {/* GM 제목 */}
        {mode === 'gm' && (
          <div className="border-b border-divider px-5 py-3">
            <input
              type="text"
              value={gmTitle}
              onChange={e => setGmTitle(e.target.value)}
              placeholder="그룹 채팅방 이름"
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
            />
          </div>
        )}

        {/* 선택된 멤버 칩 */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-divider px-5 py-2.5">
            {[...selectedIds].map(id => {
              const m = otherMembers.find(m => m.userId === id);
              return (
                <span key={id} className="flex items-center gap-1 rounded-full bg-state-primary-highlighted px-2.5 py-1 text-sub-sm text-primary">
                  {m?.name ?? id}
                  <button onClick={() => toggleSelect(id)} className="hover:text-red-500">
                    <IconClose size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* 검색 */}
        <div className="px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서, 이메일로 검색"
            className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
          />
        </div>

        {/* 멤버 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="py-8 text-center text-sub text-text-tertiary">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sub text-text-tertiary">멤버가 없습니다</div>
          ) : (
            filtered.map(member => (
              <MemberRow key={member.userId} member={member} selected={selectedIds.has(member.userId)} onToggle={() => toggleSelect(member.userId)} />
            ))
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-divider px-5 py-3">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled disabled:text-text-placeholder"
          >
            {isPending ? '생성 중...' : mode === 'dm' ? '1:1 채팅 시작' : `그룹 채팅 시작 (${selectedIds.size}명)`}
          </button>
        </div>
      </div>
    </div>
  );
}

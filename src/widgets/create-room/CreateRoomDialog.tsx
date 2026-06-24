'use client';

import { useDimmed } from '@/shared/hooks/useDimmed';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { GroupProfileAvatar } from '@/shared/ui/GroupProfileAvatar';
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
  const r = useCreateRoom(onClose);

  if (!isOpen) return null;

  const noSearchResult = r.hasAnyMember && r.pinnedSection.length === 0 && r.companySection.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={r.close} />

      <div className="relative z-10 flex h-full w-full flex-col bg-white">
        {/* macOS 신호등(좌상단 창 버튼) 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {r.step === 1 ? (
          <>
            {/* 헤더: 대화상대 선택(좌) / X(우) — 확인은 하단 버튼으로 */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-3.5 pt-1">
              <h2 className="text-base font-bold text-gray-900">대화상대 선택</h2>
              <button onClick={r.close} aria-label="닫기" className="text-gray-500 hover:text-gray-900">
                <IconClose size={20} />
              </button>
            </div>

            {/* 선택된 대화상대 (가로 스크롤, X로 제외) */}
            {r.count > 0 && (
              <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2">
                {r.selectedMembers.map((m) => (
                  <div key={m.userId} className="flex w-[60px] shrink-0 flex-col items-center gap-1 px-1.5 pt-1">
                    <div className="relative">
                      <ProfileCircle name={m.name} size="sm" storageKey={m.profileUrl} className="h-10 w-10" />
                      <button
                        onClick={() => r.removeSelected(String(m.userId))}
                        aria-label={`${m.name} 제외`}
                        className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gray-600 text-white hover:bg-gray-900"
                      >
                        <IconClose size={10} />
                      </button>
                    </div>
                    <span className="max-w-full truncate text-[11px] text-text-primary">{m.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 멤버 검색 */}
            <div className="px-4 pt-3.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-divider bg-gray-100 px-3.5 py-2.5">
                <IconSearchDefault width={20} height={20} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={r.search}
                  onChange={(e) => r.setSearch(e.target.value)}
                  placeholder="멤버 검색"
                  className="min-w-0 flex-1 bg-transparent text-sub text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </div>
            </div>

            {/* 목록 */}
            <div className="scrollbar-thin mt-3.5 flex-1 overflow-y-auto pb-2">
              {r.isLoading ? (
                <div className="py-8 text-center text-sub text-text-tertiary">로딩 중...</div>
              ) : !r.hasAnyMember ? (
                <EmptyState message="아직 함께할 멤버가 없어요." className="py-10" />
              ) : noSearchResult ? (
                <div className="py-8 text-center text-sub-sm text-text-tertiary">검색 결과가 없어요.</div>
              ) : (
                <>
                  {r.pinnedSection.length > 0 && (
                    <div className="border-b border-divider pb-1.5">
                      <div className="flex items-center gap-1 px-4 pb-1.5 pt-3.5">
                        <IconStarFilled width={20} height={20} className="text-yellow-300" />
                        <span className="text-sub-sm text-text-secondary">관심멤버 ({r.pinnedSection.length})</span>
                      </div>
                      {r.pinnedSection.map((m) => (
                        <SelectMemberRow key={`pinned-${m.userId}`} member={m} selected={r.isMember(m)} onToggle={() => r.toggleSelect(String(m.userId))} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center px-4 pb-1.5 pt-3.5">
                    <span className="text-sub-sm text-text-secondary">사내멤버 ({r.companySection.length})</span>
                  </div>
                  {r.companySection.map((m) => (
                    <SelectMemberRow key={m.userId} member={m} selected={r.isMember(m)} onToggle={() => r.toggleSelect(String(m.userId))} />
                  ))}
                </>
              )}
            </div>

            {/* 하단 확인 버튼 */}
            <div className="shrink-0 border-t border-gray-100 p-4">
              <Button variant="primary" size="lg" fullWidth disabled={!r.canConfirmStep1} onClick={r.handleStep1Confirm}>
                {r.count > 0 ? `${r.count} ` : ''}확인
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* 헤더: ←(좌) / 채팅방 정보 설정 / X(우) — 확인은 하단 버튼으로 */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-3.5 pt-1">
              <button onClick={r.goBack} aria-label="뒤로" className="text-gray-700 hover:text-gray-900">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-gray-900">채팅방 정보 설정</h2>
              <button onClick={r.close} aria-label="닫기" className="text-gray-500 hover:text-gray-900">
                <IconClose size={20} />
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto px-4 pt-5">
              {/* 참여자 아바타 — 최대 4명, 1~4명 조합 레이아웃 (RN GroupProfileAvatar 패리티) */}
              <GroupProfileAvatar
                size="lg"
                users={r.selectedMembers.map((m) => ({ name: m.name, storageKey: m.profileUrl }))}
              />

              {/* 채팅방 이름 (필수) */}
              <div className="flex w-full flex-col gap-1">
                <label className="text-sub-sm text-text-primary">채팅방 이름 (필수)</label>
                <input
                  autoFocus
                  type="text"
                  value={r.gmTitle}
                  onChange={(e) => r.setGmTitle(e.target.value)}
                  maxLength={r.maxTitle}
                  placeholder={r.namePlaceholder}
                  className="h-12 w-full rounded-lg border border-divider bg-white px-4 text-sub text-text-primary outline-none transition placeholder:truncate placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                />
                <span className="text-right text-sub-sm text-text-tertiary">{r.gmTitle.length}/{r.maxTitle}</span>
              </div>

              {/* 안내 */}
              <div className="w-full rounded-xl bg-gray-100 px-2.5 py-1.5">
                <p className="text-sub-sm text-gray-700">
                  채팅시작 전, 설정한 채팅방 이름은 모든 대화상대에게 동일하게 적용돼요.
                </p>
              </div>
            </div>

            {/* 하단 확인 버튼 */}
            <div className="shrink-0 border-t border-gray-100 p-4">
              <Button variant="primary" size="lg" fullWidth disabled={!r.canConfirmStep2} onClick={r.handleStep2Confirm}>
                확인
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

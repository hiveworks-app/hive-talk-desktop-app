'use client';

import { useDimmed } from '@/shared/hooks/useDimmed';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { GroupProfileAvatar } from '@/shared/ui/GroupProfileAvatar';
import { IconClose } from '@/shared/ui/icons';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { SelectMemberRow } from './SelectMemberRow';
import { DuplicateRoomDialog } from './DuplicateRoomDialog';
import { useCreateExternalRoom } from './useCreateExternalRoom';

interface CreateExternalRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 새 협력채팅(EM) 생성 다이얼로그.
 * Step1 대화상대 선택(협력멤버/사내멤버 2탭, 협력멤버 1명 이상 필수) → 중복검사 →
 * Step2 방 제목 설정 → 생성 후 입장. (Figma 1670-52577)
 */
export function CreateExternalRoomDialog({ isOpen, onClose }: CreateExternalRoomDialogProps) {
  useDimmed(isOpen);
  const r = useCreateExternalRoom(onClose);

  if (!isOpen) return null;

  const noSearchResult = r.hasAnyMember && r.pinnedSection.length === 0 && r.memberSection.length === 0;
  const memberSectionLabel = r.activeTab === 'external' ? '협력멤버' : '사내멤버';
  const emptyMessage =
    // RN 단일 문구 패리티 (CreateExternalRoomStep1 — 탭 무관)
    '아직 함께할 멤버가 없어요.';

  return (
    <div className="electron-no-drag fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-fade-in-fast absolute inset-0 bg-black/40" onClick={r.close} />

      <div className="animate-overlay-in relative z-10 flex h-full w-full flex-col bg-white">
        {/* macOS 신호등(좌상단 창 버튼) 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {r.step === 1 ? (
          <>
            {/* 헤더: X(좌) / 대화상대 선택(중앙) / {N} 확인(우 텍스트 버튼) — RN CreateExternalRoomScreen·사내 다이얼로그와 동일 패턴 */}
            <div className="relative h-[52px] shrink-0 border-b border-gray-100">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[100px]">
                <h2 className="truncate text-heading-md font-medium text-gray-900">대화상대 선택</h2>
              </div>
              <div className="flex h-full items-center justify-between px-4">
                <button onClick={r.close} aria-label="닫기" className="flex h-8 w-8 items-center justify-center text-gray-900 transition-opacity hover:opacity-70 active:opacity-60">
                  <IconCloseStroke width={20} height={20} />
                </button>
                <button
                  type="button"
                  onClick={r.handleStep1Confirm}
                  disabled={!r.canConfirmStep1 || r.isChecking}
                  className="px-1 text-heading-sm font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-text-tertiary"
                >
                  {r.isChecking ? '확인 중...' : `${r.count > 0 ? `${r.count} ` : ''}확인`}
                </button>
              </div>
            </div>

            {/* 협력멤버 / 사내멤버 탭 칩 */}
            <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-0.5">
              <Chip label="협력멤버" active={r.activeTab === 'external'} onClick={() => r.changeTab('external')} />
              <Chip label="사내멤버" active={r.activeTab === 'company'} onClick={() => r.changeTab('company')} />
            </div>

            {/* 선택된 대화상대 (가로 스크롤, X로 제외) */}
            {r.count > 0 && (
              <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2">
                {r.selectedMembers.map(m => (
                  <div key={m.userId} className="flex w-[60px] shrink-0 flex-col items-center gap-1 px-1.5 pt-1">
                    <div className="relative">
                      <ProfileCircle name={m.name} size="sm" storageKey={m.profileUrl} />
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
                  onChange={e => r.setSearch(e.target.value)}
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
                <EmptyState message={emptyMessage} className="py-10" />
              ) : noSearchResult ? (
                <EmptyState variant="search" message="검색 결과가 없어요." className="py-10" />
              ) : (
                <>
                  {r.pinnedSection.length > 0 && (
                    <div className="border-b border-divider pb-1.5">
                      <div className="flex items-center gap-1 px-4 pb-1.5 pt-3.5">
                        <IconStarFilled width={20} height={20} className="text-yellow-300" />
                        <span className="text-sub-sm text-text-secondary">관심멤버 ({r.pinnedSection.length})</span>
                      </div>
                      {r.pinnedSection.map(m => (
                        <SelectMemberRow
                          key={`pinned-${m.userId}`}
                          member={m}
                          selected={r.isMember(m)}
                          onToggle={() => r.toggleSelect(String(m.userId))}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center px-4 pb-1.5 pt-3.5">
                    <span className="text-sub-sm text-text-secondary">
                      {memberSectionLabel} ({r.memberSection.length})
                    </span>
                  </div>
                  {r.memberSection.map(m => (
                    <SelectMemberRow
                      key={m.userId}
                      member={m}
                      selected={r.isMember(m)}
                      onToggle={() => r.toggleSelect(String(m.userId))}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 헤더: X(좌 — Step1 복귀) / 채팅방 정보 설정(중앙) / 확인(우) — RN Info 화면·사내 Step2와 동일 패턴 */}
            <div className="relative h-[52px] shrink-0 border-b border-gray-100">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[100px]">
                <h2 className="truncate text-heading-md font-medium text-gray-900">채팅방 정보 설정</h2>
              </div>
              <div className="flex h-full items-center justify-between px-4">
                <button onClick={r.goBack} aria-label="뒤로" className="flex h-8 w-8 items-center justify-center text-gray-900 transition-opacity hover:opacity-70 active:opacity-60">
                  <IconCloseStroke width={20} height={20} />
                </button>
                <button
                  type="button"
                  onClick={r.handleStep2Confirm}
                  disabled={!r.canConfirmStep2}
                  className="px-1 text-heading-sm font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-text-tertiary"
                >
                  확인
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto px-4 pb-6 pt-5">
              {/* 참여자 아바타 — 최대 4명, 1~4명 조합 레이아웃 (RN GroupProfileAvatar 패리티) */}
              <GroupProfileAvatar
                size="lg"
                users={r.selectedMembers.map(m => ({ name: m.name, storageKey: m.profileUrl }))}
              />

              {/* 채팅방 이름 (필수) */}
              <div className="flex w-full flex-col gap-1">
                <label className="text-sub-sm text-text-primary">채팅방 이름 (필수)</label>
                <input
                  autoFocus
                  type="text"
                  value={r.title}
                  onChange={e => r.setTitle(e.target.value)}
                  maxLength={r.maxTitle}
                  placeholder={r.namePlaceholder}
                  className="h-9 w-full rounded-lg border border-divider bg-white px-4 text-sub text-text-primary outline-none transition placeholder:truncate placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                />
                <span className="text-right text-sub-sm text-text-tertiary">{r.title.length}/{r.maxTitle}</span>
              </div>

              {/* 안내 */}
              <div className="w-full rounded-xl bg-gray-100 px-2.5 py-1.5">
                <p className="text-sub-sm text-gray-700">
                  채팅시작 전, 설정한 채팅방 이름은 모든 대화상대에게 동일하게 적용돼요.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <DuplicateRoomDialog
        open={!!r.duplicateRoomId}
        memberNames={r.selectedMembers.map(m => m.name)}
        onCreateNew={r.confirmCreateNew}
        onGoExisting={r.confirmGoExisting}
        onClose={r.closeDuplicate}
      />
    </div>
  );
}

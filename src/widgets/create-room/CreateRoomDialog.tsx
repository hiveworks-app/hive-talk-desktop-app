'use client';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { GroupProfileAvatar } from '@/shared/ui/GroupProfileAvatar';
import { useEscClose } from '@/shared/hooks/useEscClose';
import { IconClose } from '@/shared/ui/icons';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { SelectMemberRow } from './SelectMemberRow';
import { useCreateRoom } from './useCreateRoom';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** DM 대화초대 → 기존 상대 포함 신규 GM 생성 진입 (RN 패리티) */
  presetMemberIds?: string[];
}

export function CreateRoomDialog({ isOpen, onClose, presetMemberIds }: CreateRoomDialogProps) {
  const r = useCreateRoom(onClose, presetMemberIds);
  // ESC = X(닫기)와 동일 — 억제 없으면 ESC가 앱 창을 트레이로 숨긴다 (2026-09-03 전수 감사)
  useEscClose(isOpen, r.close);

  if (!isOpen) return null;

  const noSearchResult = r.hasAnyMember && r.pinnedSection.length === 0 && r.companySection.length === 0;

  return (
    <div className="electron-no-drag fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-fade-in-fast absolute inset-0 bg-black/40" onClick={r.close} />

      <div className="animate-overlay-in relative z-10 flex h-full w-full flex-col bg-white">
        {/* macOS 신호등(좌상단 창 버튼) 영역 확보용 드래그 바 */}
        <div className="electron-drag h-8 w-full shrink-0" />

        {r.step === 1 ? (
          <>
            {/* 헤더: X(좌) / 대화상대 선택(중앙) / {N} 확인(우 텍스트 버튼) — RN CreateChatRoomStep1 패리티 */}
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
                  disabled={!r.canConfirmStep1}
                  className="px-1 text-heading-sm font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-text-tertiary"
                >
                  {r.count > 0 ? `${r.count} ` : ''}확인
                </button>
              </div>
            </div>

            {/* 선택된 대화상대 (가로 스크롤, X로 제외) */}
            {r.count > 0 && (
              <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2">
                {r.selectedMembers.map((m) => (
                  <div key={m.userId} className="flex w-[60px] shrink-0 flex-col items-center gap-1 px-1.5 pt-1">
                    <div className="relative">
                      <ProfileCircle name={m.name} size="sm" storageKey={m.profileUrl} />
                      {/* 기존 참여자(preset)는 제외 불가 — X 미노출 (RN 선택 스트립 제외 규칙 대응) */}
                      {!r.isPreset(String(m.userId)) && (
                        <button
                          onClick={() => r.removeSelected(String(m.userId))}
                          aria-label={`${m.name} 제외`}
                          className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gray-600 text-white hover:bg-gray-900"
                        >
                          <IconClose size={10} />
                        </button>
                      )}
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
                <div className="flex justify-center py-8 text-text-tertiary"><Spinner /></div>
              ) : !r.hasAnyMember ? (
                <EmptyState message="아직 함께할 멤버가 없어요." className="py-10" />
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
                      {r.pinnedSection.map((m) => (
                        <SelectMemberRow key={`pinned-${m.userId}`} member={m} selected={r.isMember(m)} disabled={r.isPreset(String(m.userId))} onToggle={() => r.toggleSelect(String(m.userId))} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center px-4 pb-1.5 pt-3.5">
                    <span className="text-sub-sm text-text-secondary">사내멤버 ({r.companySection.length})</span>
                  </div>
                  {r.companySection.map((m) => (
                    <SelectMemberRow key={m.userId} member={m} selected={r.isMember(m)} disabled={r.isPreset(String(m.userId))} onToggle={() => r.toggleSelect(String(m.userId))} />
                  ))}
                </>
              )}
            </div>

          </>
        ) : (
          <>
            {/* 헤더: X(좌 — Step1 복귀+이름 초기화) / 채팅방 정보 설정(중앙) / 확인(우) — RN Step2 패리티 */}
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

            <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto px-4 pt-5">
              {/* 참여자 아바타 — 최대 4명, 1~4명 조합 레이아웃 (RN GroupProfileAvatar 패리티) */}
              <GroupProfileAvatar
                size="lg"
                users={r.selectedMembers.map((m) => ({ name: m.name, storageKey: m.profileUrl }))}
              />

              {/* 채팅방 이름 (필수) */}
              <div className="flex w-full flex-col gap-1">
                <label className="text-sub-lg text-text-primary">채팅방 이름 (필수)</label>
                <input
                  autoFocus
                  type="text"
                  value={r.gmTitle}
                  onChange={(e) => r.setGmTitle(e.target.value)}
                  maxLength={r.maxTitle}
                  placeholder={r.namePlaceholder}
                  className="h-9 w-full rounded-lg border border-divider bg-white px-4 text-sub text-text-primary outline-none transition placeholder:truncate placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
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

          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { StartEMTitleDialog } from '@/features/chat-room/StartEMTitleDialog';
import { useStartMemberChat } from '@/features/chat-room/useStartMemberChat';
import { USER_ROLE, type MemberItem } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconAddMemberDefault from '@assets/icons/static/add-member-default.svg';
import IconEnvelope from '@assets/icons/envelope.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import { ExternalInviteDialog } from '@/widgets/external-invite/ExternalInviteDialog';
import { InviteStatusDialog } from '@/widgets/invite-status/InviteStatusDialog';
import { MyProfileHeader } from './_components/MyProfileHeader';
import { MemberListItem } from './_components/MemberListItem';
import { MemberRowContextMenu } from './_components/MemberRowContextMenu';
import { MemberSearchOverlay } from './_components/MemberSearchOverlay';
// [임시 숨김] 초성 인덱스 룰러 — 사용자 요청(2026-08-19)으로 잠시 비활성화 (삭제 아님)
// import { ChoseongIndexBar } from './_components/ChoseongIndexBar';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { useMembersPage } from './useMembersPage';

export default function MembersPage() {
  const {
    isOrgMember, isSearchOpen, setIsSearchOpen,
    activeChip, setActiveChip, selectedMember, setSelectedMember,
    isMyProfileOpen, setIsMyProfileOpen, displayMembers, handleMemberPress, findMemberByRowId, isLoading,
    pinnedDisplay, hasContent, memberSectionLabel, newMembers,
    isInviteOpen, setIsInviteOpen,
    isStatusOpen, setIsStatusOpen, receivedInviteCount,
  } = useMembersPage();

  // 멤버 행 우클릭 메뉴 (데스크톱 관례) — 커서 좌표 + 대상 멤버
  const [memberMenu, setMemberMenu] = useState<{ x: number; y: number; member: MemberItem } | null>(null);
  const handleRowContextMenu = (id: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const member = findMemberByRowId(id);
    if (member) setMemberMenu({ x: e.clientX, y: e.clientY, member });
  };

  // 행 더블클릭 = 1:1 채팅 (데스크톱 관례). 싱글클릭 프로필은 250ms 지연해 더블클릭과 구분 —
  // 채팅 시작이 불가능한 행(본인·게스트 뷰어)은 지연 없이 즉시 프로필을 연다.
  const myUserId = useAuthStore(s => s.user?.id);
  const isViewerGuest = useAuthStore(s => s.user?.role) === USER_ROLE.GUEST;
  const startMemberChat = useStartMemberChat();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canStartChat = (member: MemberItem) =>
    !isViewerGuest && String(member.userId) !== String(myUserId);
  const handleRowClick = (id: string) => {
    const member = findMemberByRowId(id);
    if (!member) return;
    if (!canStartChat(member)) {
      setSelectedMember(member);
      return;
    }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setSelectedMember(member);
    }, 250);
  };
  const handleRowDoubleClick = (id: string) => {
    const member = findMemberByRowId(id);
    if (!member || !canStartChat(member)) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    startMemberChat.startChat(member);
  };
  useEffect(
    () => () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    },
    [],
  );

  // 인덱스 룰러 점프용 스크롤 컨테이너 (30명 이상일 때만 룰러 노출 — RN 패리티)
  const listContainerRef = useRef<HTMLDivElement>(null);
  // [임시 숨김] 인덱스 룰러 노출 조건·점프 핸들러 — 사용자 요청(2026-08-19)으로 잠시 비활성화.
  // 복원 시 아래 주석과 상단 import, 목록 상단의 <ChoseongIndexBar /> JSX 주석을 함께 해제하면 된다.
  // const showIndexBar = !isSearching && displayMembers.length >= 30;
  // const jumpToMemberIndex = (index: number) => {
  //   const el = listContainerRef.current?.querySelector(`[data-ruler-index="${index}"]`);
  //   el?.scrollIntoView({ block: 'start' });
  // };
  // const jumpToTop = () => {
  //   listContainerRef.current?.scrollTo({ top: 0 });
  // };

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-gray-100">
      <header className="electron-drag">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-heading-xl font-semibold text-text-primary">멤버목록</h2>
          <div className="electron-no-drag flex items-center gap-1">
            {/* 검색은 별도 풀스크린 화면으로 push (RN /member-search 방식 — 2026-08-20 사용자 확정) */}
            <button onClick={() => setIsSearchOpen(true)} aria-label="멤버 검색" className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60">
              <IconSearchDefault width={24} height={24} />
            </button>
            {/* 초대하기(사람+)는 사내멤버 전용 — 게스트에게는 노출하지 않는다 (RN MembersScreen 패리티) */}
            {isOrgMember && (
              <button onClick={() => setIsInviteOpen(true)} aria-label="멤버 초대" className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60">
                <IconAddMemberDefault width={24} height={24} />
              </button>
            )}
            {/* 편지봉투 = 초대현황(받은/보낸). 받은 초대가 있으면 빨간 dot 표시 (RN 패리티) */}
            <button onClick={() => setIsStatusOpen(true)} aria-label="초대 현황" className="relative flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60">
              <IconEnvelope width={24} height={24} />
              {receivedInviteCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-state-error" />
              )}
            </button>
          </div>
        </div>
      </header>

      <MyProfileHeader onOpenProfile={() => setIsMyProfileOpen(true)} />

      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {isOrgMember && (
          <div className="flex items-center gap-1.5 px-4 py-3.5">
            {/* 칩 전환 시 리스트 최상단으로 — 짧은 목록 전환 시 빈 화면 방지 (RN scrollToOffset(0) 패리티) */}
            <Chip label="전체" active={activeChip === 'all'} onClick={() => { setActiveChip('all'); listContainerRef.current?.scrollTo({ top: 0 }); }} />
            <Chip label="사내멤버" active={activeChip === 'company'} onClick={() => { setActiveChip('company'); listContainerRef.current?.scrollTo({ top: 0 }); }} />
            <Chip label="협력멤버" active={activeChip === 'external'} onClick={() => { setActiveChip('external'); listContainerRef.current?.scrollTo({ top: 0 }); }} />
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
        {/* [임시 숨김] 초성/알파벳 인덱스 룰러 (RN ChoseongIndexBar 패리티 — 클릭 점프)
            사용자 요청(2026-08-19)으로 잠시 숨김 — 코드 삭제 아님. 복원 시 이 주석과
            상단 import·showIndexBar/jump 핸들러 주석을 함께 해제하면 된다.
        {showIndexBar && (
          <ChoseongIndexBar
            names={displayMembers.map(m => m.name)}
            onJump={jumpToMemberIndex}
            onJumpToTop={jumpToTop}
          />
        )}
        */}
        <div ref={listContainerRef} className="scrollbar-thin h-full overflow-y-auto">
          {isLoading ? (
            /* RN 패리티 — 첫 동기화 중 32px 스피너 */
            <div className="flex h-full items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-400" />
            </div>
          ) : !hasContent ? (
            /* RN 패리티 — 빈 상태는 꿀벌 일러스트 + 중앙 정렬 */
            <EmptyState message="아직 함께할 멤버가 없어요." className="h-full" />
          ) : (
            <>
              {/* 신규 멤버 섹션 — 칩 아래·관심멤버 위, 가로 스크롤 (RN NewMemberSection 패리티, Figma 2444:129748) */}
              {newMembers.length > 0 && (
                <div className="border-b border-divider pb-[7px] pt-[7px]">
                  <div className="px-4 pb-[7px]">
                    <span className="text-sub-sm text-text-secondary">새로운 멤버 ({newMembers.length})</span>
                  </div>
                  <div className="scrollbar-thin flex overflow-x-auto px-4">
                    {newMembers.map(m => (
                      <button
                        key={m.userId}
                        onClick={() => handleMemberPress(`${m.isExternal ? 'external' : 'company'}-${m.userId}`)}
                        className="flex w-[66px] shrink-0 flex-col items-center gap-[1px] rounded-lg px-2 py-[7px] transition-colors hover:bg-gray-100"
                      >
                        <ProfileCircle name={m.name} size="md" storageKey={m.thumbnailProfileUrl || m.profileUrl} className="h-11 w-11" />
                        <span className="w-full truncate text-center text-sub-sm text-text-primary">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {pinnedDisplay.length > 0 && (
                <div className="border-b border-divider pb-3.5">
                  <div className="flex items-end gap-1 px-4 pt-1">
                    <IconStarFilled width={20} height={20} className="text-yellow" />
                    <span className="text-sub-sm text-text-secondary">관심멤버 ({pinnedDisplay.length})</span>
                  </div>
                  {/* 관심멤버 순서변경·일괄 편집은 기어 메뉴 > 멤버목록 편집에서 (RN 패리티) */}
                  <div className="mt-1 flex flex-col">
                    {pinnedDisplay.map(item => (
                      <MemberListItem key={item.id} member={item} onClick={() => handleRowClick(item.id)} onDoubleClick={() => handleRowDoubleClick(item.id)} onContextMenu={handleRowContextMenu(item.id)} />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 px-4 py-3">
                <span className="text-sub-sm text-text-secondary">
                  {`${memberSectionLabel} (${displayMembers.length})`}
                </span>
              </div>
              <div className="flex flex-col">
                {displayMembers.map((item, index) => (
                  <div key={item.id} data-ruler-index={index}>
                    <MemberListItem
                      member={item}
                      onClick={() => handleRowClick(item.id)}
                      onDoubleClick={() => handleRowDoubleClick(item.id)}
                      onContextMenu={handleRowContextMenu(item.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {isSearchOpen && <MemberSearchOverlay onClose={() => setIsSearchOpen(false)} />}
      {/* 멤버 행 우클릭 메뉴 — 프로필 보기/관심멤버/차단 */}
      {memberMenu && (
        <MemberRowContextMenu
          member={memberMenu.member}
          x={memberMenu.x}
          y={memberMenu.y}
          onOpenProfile={() => setSelectedMember(memberMenu.member)}
          onClose={() => setMemberMenu(null)}
        />
      )}
      <UserProfileDialog isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} member={selectedMember} />
      {/* 행 더블클릭 EM 신규 채팅 — 방 제목 입력 */}
      <StartEMTitleDialog
        draft={startMemberChat.emTitleDraft}
        onChangeTitle={startMemberChat.setEmDraftTitle}
        onConfirm={startMemberChat.confirmEmDraft}
        onCancel={startMemberChat.cancelEmDraft}
      />
      <MyProfileDialog isOpen={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} />
      <ExternalInviteDialog open={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <InviteStatusDialog open={isStatusOpen} onClose={() => setIsStatusOpen(false)} />
    </main>
  );
}

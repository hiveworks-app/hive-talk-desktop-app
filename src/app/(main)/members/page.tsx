'use client';

import { cn } from '@/shared/lib/cn';
import { IconClose } from '@/shared/ui/icons';
import IconSearchDefault from '@assets/icons/search-default.svg';
import IconAddMemberDefault from '@assets/icons/add-member-default.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import { MyProfileHeader } from './_components/MyProfileHeader';
import { MemberListItem } from './_components/MemberListItem';
import { Chip } from './_components/Chip';
import { useMembersPage } from './useMembersPage';

export default function MembersPage() {
  const {
    isOrgMember, search, setSearch, isSearchVisible, toggleSearch, clearSearch,
    activeChip, setActiveChip, searchInputRef, selectedMember, setSelectedMember,
    isMyProfileOpen, setIsMyProfileOpen, displayMembers, handleMemberPress, isLoading,
  } = useMembersPage();

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-gray-100">
      <header className="electron-drag">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-heading-lg font-semibold text-text-primary">멤버목록</h2>
          <div className="electron-no-drag flex items-center gap-1">
            <button onClick={toggleSearch} className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200">
              <IconSearchDefault width={20} height={20} />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-200">
              <IconAddMemberDefault width={20} height={20} />
            </button>
          </div>
        </div>
      </header>

      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', isSearchVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-b border-divider bg-background px-4 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                ref={searchInputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') clearSearch(); }}
                placeholder="찾으시는 분의 성함을 입력하세요."
                className="flex-1 rounded-md border border-divider bg-gray-50 px-3 py-1.5 text-sub text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary"
              />
              <button onClick={clearSearch} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-gray-100">
                <IconClose size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <MyProfileHeader onOpenProfile={() => setIsMyProfileOpen(true)} />

      <div className="flex flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {isOrgMember && (
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <Chip label="전체" active={activeChip === 'all'} onClick={() => setActiveChip('all')} />
            <Chip label="사내멤버" active={activeChip === 'company'} onClick={() => setActiveChip('company')} />
            <Chip label="협력멤버" active={activeChip === 'external'} onClick={() => setActiveChip('external')} />
          </div>
        )}

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><span className="text-sub text-text-tertiary">로딩 중...</span></div>
          ) : displayMembers.length === 0 ? (
            <div className="flex items-center justify-center py-8"><span className="text-sub text-text-tertiary">멤버가 없습니다</span></div>
          ) : (
            <>
              <div className="border-b border-divider pb-3.5">
                <div className="flex items-end gap-1 px-4">
                  <IconStarFilled width={20} height={20} />
                  <span className="text-sub-sm text-text-secondary">관심 멤버 (3)</span>
                </div>
                <div className="mt-1 flex flex-col">
                  {[1, 2, 3].map(i => (
                    <MemberListItem key={i} member={{ id: `favorite-${i}`, name: `홍길동${i}`, description: '생산2팀 · 대리' }} onClick={() => handleMemberPress(`favorite-${i}`)} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 px-4 py-3">
                <span className="text-sub-sm text-text-secondary">전체멤버 ({displayMembers.length})</span>
              </div>
              <div className="flex flex-col">
                {displayMembers.map(item => (
                  <MemberListItem key={item.id} member={item} onClick={() => handleMemberPress(item.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <UserProfileDialog isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} member={selectedMember} />
      <MyProfileDialog isOpen={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} />
    </main>
  );
}

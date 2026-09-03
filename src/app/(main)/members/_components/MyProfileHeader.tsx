'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMyProfileHook } from '@/features/profile/useMyProfileHook';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconArrowRightDefault from '@assets/icons/arrow-right-default.svg';
import IconBlock from '@assets/icons/block.svg';
import IconSettingsFilled from '@assets/icons/settings-filled.svg';
import IconStarFilled from '@assets/icons/star-filled.svg';
import { MemberListEditDialog } from './MemberListEditDialog';

interface MyProfileHeaderProps {
  onOpenProfile: () => void;
}

export function MyProfileHeader({ onOpenProfile }: MyProfileHeaderProps) {
  const { name, department, job, profileUrl } = useMyProfileHook();
  const router = useAppRouter();
  const [isEditOpen, setEditOpen] = useState(false);
  // ESC=메뉴 닫기만 — 억제 없으면 Radix가 닫는 순간 메인이 창을 트레이로 숨긴다 (2026-09-03)
  const [isMenuOpen, setMenuOpen] = useState(false);
  useEscSuppress(isMenuOpen);

  // RN MembersProfileHeader 패리티 — 하단 여백 pb-3(12px), 아래 흰색 카드와의 간격
  return (
    <div className="flex items-center px-4 pb-3 pt-3">
      {/* 좌측: 프로필 이미지 + 텍스트 */}
      <button
        onClick={onOpenProfile}
        className="flex flex-1 items-center gap-3.5 text-left"
      >
        <ProfileCircle name={name ?? '?'} size="lg" storageKey={profileUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-heading-md font-semibold text-text-primary">
            {name}
          </div>
          {(department || job) && (
            <div className="flex items-center gap-1 text-sub-sm text-text-primary">
              <span>{[department, job].filter(Boolean).join(' · ')}</span>
              <IconArrowRightDefault width={14} height={14} className="text-gray-900" />
            </div>
          )}
        </div>
      </button>

      {/* 우측: 설정 기어 → 드롭다운 (RN MembersProfileHeader 패리티: 관심멤버 편집 / 차단멤버 관리) */}
      <DropdownMenu.Root modal={false} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="멤버목록 설정"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gray-300 text-gray-500 transition-opacity hover:opacity-70 active:opacity-60"
          >
            {/* RN 패리티 — 30px 원형 gray-300 배경 + IconSettingsFilled 24px gray-500 */}
            <IconSettingsFilled width={24} height={24} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          {/* RN AnchoredActionMenu 패리티 — 160px, 항목 46px, 항목 간 구분선, pressed gray-200 */}
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="motion-menu z-50 w-40 overflow-hidden rounded-xl bg-white shadow-[0px_2px_15px_rgba(0,0,0,0.15)]"
          >
            <DropdownMenu.Item
              onSelect={() => {
                // Radix 메뉴 닫힘(포커스 복원·pointer-events 해제) 완료 후 오버레이 마운트 —
                // 동기 마운트 시 body pointer-events:none 잔존으로 화면 전체가 잠기는 버그 회피
                setTimeout(() => setEditOpen(true), 0);
              }}
              className="flex h-[46px] cursor-pointer items-center gap-1.5 border-b border-gray-200 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <IconStarFilled width={20} height={20} className="text-gray-600" />
              </span>
              관심멤버 편집
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => router.push('/settings/blocked-members')}
              className="flex h-[46px] cursor-pointer items-center gap-1.5 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <IconBlock width={20} height={20} className="text-gray-600" />
              </span>
              차단멤버 관리
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* 멤버목록 편집 (관심멤버 드래그 정렬 + 일괄 등록/해제) */}
      {isEditOpen && <MemberListEditDialog open onClose={() => setEditOpen(false)} />}
    </div>
  );
}

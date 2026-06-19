'use client';

import { ProfileInfoSection } from './ProfileInfoSection';
import IconPencil from '@assets/icons/pencil.svg';
import type { AuthSaveUserInfoTypes } from '@/store/auth/authStore';

interface ProfileViewModeProps {
  user: AuthSaveUserInfoTypes;
  onEdit: () => void;
}

export function ProfileViewMode({ user, onEdit }: ProfileViewModeProps) {
  const isGuest = user.role === 'GUEST';
  // 게스트(협력멤버)는 입력해둔 회사명을 함께 노출하고, 사내 멤버는 부서·직책만 노출한다.
  const lines = isGuest
    ? [user.companyName, user.department, user.job]
    : [user.department, user.job];

  return (
    <div className="flex flex-col px-4 pb-6 pt-7">
      <ProfileInfoSection
        name={user.name}
        email={user.email}
        storageKey={user.profileUrl}
        lines={lines}
        showMeBadge
      />
      <button
        onClick={onEdit}
        className="mt-[30px] flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-outline bg-surface text-[16px] font-medium text-text-primary transition-colors hover:bg-surface-pressed"
      >
        <IconPencil width={18} height={18} />
        프로필 수정
      </button>
    </div>
  );
}

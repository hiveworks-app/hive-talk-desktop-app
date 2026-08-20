'use client';

import { ProfileInfoSection } from './ProfileInfoSection';
import IconPencil from '@assets/icons/pencil.svg';
import type { AuthSaveUserInfoTypes } from '@/store/auth/authStore';

interface ProfileViewModeProps {
  user: AuthSaveUserInfoTypes;
  onEdit: () => void;
}

export function ProfileViewMode({ user, onEdit }: ProfileViewModeProps) {
  // RN MyProfileView 패리티 — 회사명은 role 무관 값이 있으면 표시
  const lines = [user.companyName, user.department, user.job];

  // RN MyProfileView 패리티 — 콘텐츠 세로 중앙 정렬, 이미지 블록과 버튼 사이 30px
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <div className="flex w-full flex-col items-center gap-[30px]">
        <ProfileInfoSection
          name={user.name}
          email={user.email}
          storageKey={user.profileUrl}
          lines={lines}
          showMeBadge
        />
        {/* RN Button outlined/dark 패리티 — 흰 배경 + gray-200 테두리 + gray-900 텍스트, 연필 24px */}
        <button
          onClick={onEdit}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-gray-200 bg-white text-body font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          <IconPencil width={24} height={24} />
          프로필 수정
        </button>
      </div>
    </div>
  );
}

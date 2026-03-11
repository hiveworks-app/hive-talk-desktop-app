'use client';

import { useMyProfileHook } from '@/features/profile/useMyProfileHook';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconSettingsFilled from '@assets/icons/settings-filled.svg';
import IconArrowRightDefault from '@assets/icons/arrow-right-default.svg';

interface MyProfileHeaderProps {
  onOpenProfile: () => void;
}

export function MyProfileHeader({ onOpenProfile }: MyProfileHeaderProps) {
  const { name, department, job, profileUrl } = useMyProfileHook();

  return (
    <div className="flex items-center px-4 pb-2 pt-3">
      {/* 좌측: 프로필 이미지 + 텍스트 */}
      <button
        onClick={onOpenProfile}
        className="flex flex-1 items-center gap-3.5 text-left"
      >
        <ProfileCircle name={name ?? '?'} size="lg" storageKey={profileUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold text-text-primary">
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

      {/* 우측: 설정 아이콘 */}
      <button
        onClick={onOpenProfile}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gray-300 p-1.5 text-gray-500 transition-colors hover:bg-gray-400"
      >
        <IconSettingsFilled width={24} height={24} />
      </button>
    </div>
  );
}

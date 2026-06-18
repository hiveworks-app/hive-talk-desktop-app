'use client';

import { useMyProfileHook } from '@/features/profile/useMyProfileHook';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
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
          <div className="text-heading-md font-semibold text-text-primary">
            {name}
          </div>
          {(department || job) && (
            <div className="flex items-center gap-[5px] text-sub-sm text-text-primary">
              <span>{[department, job].filter(Boolean).join(' · ')}</span>
              <IconArrowRightDefault width={16} height={16} className="text-gray-500" />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

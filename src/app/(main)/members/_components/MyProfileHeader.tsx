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
          <div className="text-[18px] font-semibold leading-[26px] tracking-[-0.18px] text-text-primary">
            {name}
          </div>
          {(department || job) && (
            <div className="flex items-center gap-[5px] text-[13px] leading-[16px] tracking-[0.13px] text-text-primary">
              <span>{[department, job].filter(Boolean).join(' · ')}</span>
              <IconArrowRightDefault width={16} height={16} className="text-gray-500" />
            </div>
          )}
        </div>
      </button>

      {/* 우측: 설정 아이콘 */}
      <button
        onClick={onOpenProfile}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gray-300 text-gray-500 transition-colors hover:bg-gray-400"
      >
        <IconSettingsFilled width={22} height={22} />
      </button>
    </div>
  );
}

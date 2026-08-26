'use client';

import { useMyProfileUpdate } from '@/features/profile/queries';
import { getErrorMessage } from '@/shared/api';
import { useUIStore } from '@/store/uiStore';
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

  // 뷰어 내 [삭제] — 기본 이미지로 변경 (RN ProfileImageViewerScreen 패리티).
  // 프로필 갱신 payload는 편집 저장과 동일 규칙(연락처 보존 전송), 이미지 키만 null.
  const { mutateAsync: updateProfile } = useMyProfileUpdate();
  const isGuest = user.role === 'GUEST';
  const handleDeleteImage = () => {
    void updateProfile({
      ...(isGuest && { companyName: user.companyName ?? null }),
      name: user.name,
      department: user.department ?? null,
      job: user.job ?? null,
      phoneHead: user.phoneHead ?? null,
      phoneMid: user.phoneMid ?? null,
      phoneTail: user.phoneTail ?? null,
      profileUrl: null,
      thumbnailProfileUrl: null,
    }).catch((err: unknown) => {
      // useMyProfileUpdate에는 onError가 없어 여기서 안내하지 않으면 무음 실패가 된다 (2026-08-26 리뷰)
      useUIStore.getState().showSnackbar({
        message: getErrorMessage(err, '프로필 이미지 삭제에 실패했습니다.'),
        state: 'error',
      });
    });
  };

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
          onEditProfile={onEdit}
          onDeleteImage={user.profileUrl ? handleDeleteImage : undefined}
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

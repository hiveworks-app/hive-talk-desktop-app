'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth/authStore';
import { ProfileDialogShell } from './ProfileDialogShell';
import { ProfileViewMode } from './ProfileViewMode';
import { ProfileEditMode } from './ProfileEditMode';

interface MyProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyProfileDialog({ isOpen, onClose }: MyProfileDialogProps) {
  const user = useAuthStore(s => s.user);
  const [isEditing, setIsEditing] = useState(false);
  // 헤더 [완료] disabled — 이름 공백 시 실시간 비활성 (RN canSaveProfile 패리티)
  const [canSave, setCanSave] = useState(true);

  if (!isOpen || !user) return null;

  // 닫을 때 편집 모드를 초기화 → 재오픈 시 항상 보기 모드부터 시작
  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  return (
    // 편집 모드: 타이틀 "프로필 수정", ←는 보기 모드로 복귀(편집 취소), 헤더 우측 [완료]가 저장
    // (RN MyProfileHeaderEdit 패리티 — form 속성으로 ProfileEditMode의 폼 submit을 트리거).
    // 보기 모드: ←는 화면 닫기.
    <ProfileDialogShell
      title={isEditing ? '프로필 수정' : '내 프로필'}
      onClose={isEditing ? () => setIsEditing(false) : handleClose}
      headerRight={
        isEditing ? (
          // RN ScreenHeaderTextButton 패리티 — 16px medium gray-900, 이름 공백 시 disabled
          <button
            type="submit"
            form="profile-edit-form"
            disabled={!canSave}
            className="flex h-8 items-center px-2 text-body font-medium text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 disabled:text-gray-400"
          >
            완료
          </button>
        ) : undefined
      }
    >
      {isEditing ? (
        <ProfileEditMode user={user} onDone={() => setIsEditing(false)} onValidityChange={setCanSave} />
      ) : (
        <ProfileViewMode user={user} onEdit={() => setIsEditing(true)} />
      )}
    </ProfileDialogShell>
  );
}

'use client';

import { useState } from 'react';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
import { ProfileDialogShell } from './ProfileDialogShell';
import { ProfileViewMode } from './ProfileViewMode';
import { ProfileEditMode } from './ProfileEditMode';

interface MyProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyProfileDialog({ isOpen, onClose }: MyProfileDialogProps) {
  useDimmed(isOpen);
  const user = useAuthStore(s => s.user);
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen || !user) return null;

  // 닫을 때 편집 모드를 초기화 → 재오픈 시 항상 보기 모드부터 시작
  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  return (
    // 편집 모드: 타이틀 "프로필 수정" + 닫기(✕)는 보기 모드로 복귀(편집 취소). 보기 모드: 닫기(✕)는 모달 종료.
    <ProfileDialogShell
      title={isEditing ? '프로필 수정' : '내 프로필'}
      onClose={isEditing ? () => setIsEditing(false) : handleClose}
    >
      {isEditing ? (
        <ProfileEditMode user={user} onDone={() => setIsEditing(false)} />
      ) : (
        <ProfileViewMode user={user} onEdit={() => setIsEditing(true)} />
      )}
    </ProfileDialogShell>
  );
}

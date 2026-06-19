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
    <ProfileDialogShell title="내 프로필" onClose={handleClose}>
      {isEditing ? (
        <ProfileEditMode user={user} onDone={() => setIsEditing(false)} />
      ) : (
        <ProfileViewMode user={user} onEdit={() => setIsEditing(true)} />
      )}
    </ProfileDialogShell>
  );
}

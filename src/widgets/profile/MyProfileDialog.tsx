'use client';

import { useState } from 'react';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[400px] rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-heading-sm font-bold text-text-primary">내 프로필</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isEditing ? (
          <ProfileEditMode user={user} onDone={() => setIsEditing(false)} />
        ) : (
          <ProfileViewMode user={user} onEdit={() => setIsEditing(true)} />
        )}
      </div>
    </div>
  );
}

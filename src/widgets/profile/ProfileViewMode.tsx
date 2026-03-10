'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import type { AuthSaveUserInfoTypes } from '@/store/auth/authStore';

interface ProfileViewModeProps {
  user: AuthSaveUserInfoTypes;
  onEdit: () => void;
}

export function ProfileViewMode({ user, onEdit }: ProfileViewModeProps) {
  const phone =
    user.phoneHead && user.phoneMid && user.phoneTail
      ? `${user.phoneHead}-${user.phoneMid}-${user.phoneTail}`
      : null;

  return (
    <div className="p-5">
      <div className="flex flex-col items-center gap-3 pb-5">
        <ProfileCircle
          name={user.name}
          storageKey={user.profileUrl}
          className="h-20 w-20"
        />
        <div className="text-center">
          <div className="text-heading-md font-bold text-text-primary">{user.name}</div>
          <div className="text-sub text-text-secondary">{user.email}</div>
        </div>
      </div>

      <div className="space-y-3 border-t border-divider pt-4">
        <InfoRow label="부서" value={user.department} />
        <InfoRow label="직책" value={user.job} />
        <InfoRow label="전화번호" value={phone} />
        <InfoRow label="조직" value={user.organization?.organizationName} />
      </div>

      <button
        onClick={onEdit}
        className="mt-5 w-full rounded-lg border border-primary py-2.5 text-sub font-semibold text-primary transition-colors hover:bg-state-primary-highlighted"
      >
        프로필 수정
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub text-text-tertiary">{label}</span>
      <span className="text-sub text-text-primary">{value}</span>
    </div>
  );
}

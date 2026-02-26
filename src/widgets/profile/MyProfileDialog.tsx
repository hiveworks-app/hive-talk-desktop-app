'use client';

import { useState, useRef } from 'react';
import { useMyProfileUpdate, useMyProfileImageUpload } from '@/features/profile/queries';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { useAuthStore, AuthSaveUserInfoTypes } from '@/store/auth/authStore';
import { useUIStore } from '@/store';

interface MyProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyProfileDialog({ isOpen, onClose }: MyProfileDialogProps) {
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
          <EditMode user={user} onDone={() => setIsEditing(false)} />
        ) : (
          <ViewMode user={user} onEdit={() => setIsEditing(true)} />
        )}
      </div>
    </div>
  );
}

function ViewMode({ user, onEdit }: { user: AuthSaveUserInfoTypes; onEdit: () => void }) {
  const phone =
    user.phoneHead && user.phoneMid && user.phoneTail
      ? `${user.phoneHead}-${user.phoneMid}-${user.phoneTail}`
      : null;

  return (
    <div className="p-5">
      {/* 아바타 */}
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

      {/* 정보 */}
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

function EditMode({ user, onDone }: { user: AuthSaveUserInfoTypes; onDone: () => void }) {
  const { mutateAsync: updateProfile, isPending } = useMyProfileUpdate();
  const { mutateAsync: uploadImage, isPending: imgPending } = useMyProfileImageUpload();
  const { showSnackbar, showLoadingOverlay, hideLoadingOverlay } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name);
  const [department, setDepartment] = useState(user.department ?? '');
  const [job, setJob] = useState(user.job ?? '');
  const [phoneHead, setPhoneHead] = useState(user.phoneHead ?? '');
  const [phoneMid, setPhoneMid] = useState(user.phoneMid ?? '');
  const [phoneTail, setPhoneTail] = useState(user.phoneTail ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newProfileKey, setNewProfileKey] = useState<string | null>(null);
  const { data: currentPresignedUrl } = usePresignedUrl(user.profileUrl);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    showLoadingOverlay({ message: '이미지를 업로드하는 중...' });

    try {
      const result = await uploadImage({ file });
      setNewProfileKey(result.fileKey);
    } catch {
      setPreviewUrl(null);
      showSnackbar({ message: '이미지 업로드에 실패했습니다.', state: 'error' });
    } finally {
      hideLoadingOverlay();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showSnackbar({ message: '이름을 입력해주세요.', state: 'error' });
      return;
    }

    const profileKey = newProfileKey ?? user.profileUrl ?? null;
    const thumbKey = newProfileKey ?? user.thumbnailProfileUrl ?? null;

    await updateProfile({
      name: name.trim(),
      department: department.trim() || null,
      job: job.trim() || null,
      phoneHead: phoneHead.trim() || null,
      phoneMid: phoneMid.trim() || null,
      phoneTail: phoneTail.trim() || null,
      profileUrl: profileKey,
      thumbnailProfileUrl: thumbKey,
    });

    onDone();
  };

  const avatarSrc = previewUrl ?? currentPresignedUrl;

  return (
    <div className="p-5">
      {/* 아바타 + 변경 버튼 */}
      <div className="flex flex-col items-center gap-3 pb-5">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-100"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <img src="/empty-profile.png" alt={user.name} className="h-full w-full rounded-full object-contain p-2" />
          )}
          <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </button>
      </div>

      {/* 입력 필드 */}
      <div className="space-y-3">
        <EditField label="이름" value={name} onChange={setName} required />
        <EditField label="부서" value={department} onChange={setDepartment} />
        <EditField label="직책" value={job} onChange={setJob} />
        <div>
          <label className="mb-1 block text-sub-sm font-medium text-text-secondary">전화번호</label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={phoneHead}
              onChange={e => setPhoneHead(e.target.value)}
              placeholder="010"
              maxLength={3}
              className="w-16 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub text-text-primary outline-none focus:border-primary"
            />
            <span className="text-text-tertiary">-</span>
            <input
              type="text"
              value={phoneMid}
              onChange={e => setPhoneMid(e.target.value)}
              placeholder="0000"
              maxLength={4}
              className="w-20 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub text-text-primary outline-none focus:border-primary"
            />
            <span className="text-text-tertiary">-</span>
            <input
              type="text"
              value={phoneTail}
              onChange={e => setPhoneTail(e.target.value)}
              placeholder="0000"
              maxLength={4}
              className="w-20 rounded-lg border border-divider bg-surface px-2 py-2 text-center text-sub text-text-primary outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={onDone}
          className="flex-1 rounded-lg border border-divider py-2.5 text-sub font-medium text-text-secondary transition-colors hover:bg-surface-pressed"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
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

function EditField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sub-sm font-medium text-text-secondary">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none focus:border-primary"
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useMyProfileUpdate, useMyProfileImageUpload } from '@/features/profile/queries';
import { prepareProfileImage } from '@/features/profile/prepareProfileImage';
import { getErrorMessage } from '@/shared/api';
import { isOffline } from '@/shared/utils/offlineGuard';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { useUIStore } from '@/store';
import IconDefaultCamera from '@assets/icons/chat-room-bottom-camera.svg';
import type { AuthSaveUserInfoTypes } from '@/store/auth/authStore';

/** 정책서 auth.md: 이름·회사명·부서·직급 각 최대 20자 */
const PROFILE_FIELD_MAX_LENGTH = 20;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProfileEditModeProps {
  user: AuthSaveUserInfoTypes;
  onDone: () => void;
  /** 저장 가능 여부(이름 공백 검증) 변경 통지 — 헤더 [완료] disabled 연동 (RN onValidityChange 패리티) */
  onValidityChange?: (canSave: boolean) => void;
}

type ImageStatus = 'idle' | 'uploading' | 'done';

export function ProfileEditMode({ user, onDone, onValidityChange }: ProfileEditModeProps) {
  const { mutateAsync: updateProfile, isPending } = useMyProfileUpdate();
  const { mutateAsync: uploadImage } = useMyProfileImageUpload();
  const { showSnackbar } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGuest = user.role === 'GUEST';
  const [name, setName] = useState(user.name);
  const [companyName, setCompanyName] = useState(user.companyName ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [job, setJob] = useState(user.job ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newProfileKey, setNewProfileKey] = useState<string | null>(null);
  const [newThumbKey, setNewThumbKey] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageStatus, setImageStatus] = useState<ImageStatus>('idle');
  const { data: currentPresignedUrl } = usePresignedUrl(user.profileUrl);

  // 업로드/변경 완료 체크(반영후)는 잠깐만 노출 — 언마운트 시 타이머 정리
  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  const flashDone = () => {
    setImageStatus('done');
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    doneTimerRef.current = setTimeout(() => setImageStatus('idle'), 1000);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showSnackbar({ message: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.', state: 'error' });
      return;
    }
    if (isOffline()) return;

    setRemoveImage(false);
    setPreviewUrl(URL.createObjectURL(file));
    setImageStatus('uploading');

    try {
      // RN MyProfileEdit 패리티 — 원본 압축(1MB 초과) + 128px 썸네일(0.4MB 이상) 생성 후 각각 업로드
      const { original, thumbnail } = await prepareProfileImage(file);
      const result = await uploadImage({ file: original });
      const thumbResult = thumbnail ? await uploadImage({ file: thumbnail }) : null;
      setNewProfileKey(result.fileKey);
      setNewThumbKey(thumbResult?.fileKey ?? result.fileKey);
      flashDone();
    } catch (err) {
      // 부분 성공(원본만 업로드)도 전체 실패로 취급 — 이전 선택까지 폐기해 미리보기·저장 값 불일치를 막는다
      setPreviewUrl(null);
      setNewProfileKey(null);
      setNewThumbKey(null);
      setImageStatus('idle');
      showSnackbar({ message: getErrorMessage(err, '이미지 업로드에 실패했습니다.'), state: 'error' });
    }
  };

  // 기본 이미지로 변경 — 저장 시 profileUrl/thumbnail을 null로 명시 전송한다.
  const handleUseDefault = () => {
    setPreviewUrl(null);
    setNewProfileKey(null);
    setNewThumbKey(null);
    setRemoveImage(true);
    flashDone();
  };

  const handleSave = async () => {
    if (isPending) return;
    if (!name.trim()) {
      showSnackbar({ message: '이름을 입력해주세요.', state: 'error' });
      return;
    }
    if (isOffline()) return;

    const profileKey = removeImage ? null : (newProfileKey ?? user.profileUrl ?? null);
    const thumbKey = removeImage ? null : (newThumbKey ?? user.thumbnailProfileUrl ?? null);

    try {
      await updateProfile({
        ...(isGuest && { companyName: companyName.trim() || null }),
        name: name.trim(),
        department: department.trim() || null,
        job: job.trim() || null,
        // 연락처는 앱 정책상 편집 폼에 노출하지 않는다 — 기존 값을 그대로 보존 전송(미노출 ≠ 삭제).
        phoneHead: user.phoneHead ?? null,
        phoneMid: user.phoneMid ?? null,
        phoneTail: user.phoneTail ?? null,
        profileUrl: profileKey,
        thumbnailProfileUrl: thumbKey,
      });
      // 성공 토스트는 useMyProfileUpdate onSuccess가 단일로 처리 (중복 방지)
      onDone();
    } catch (err) {
      showSnackbar({ message: getErrorMessage(err, '프로필 수정에 실패했습니다.'), state: 'error' });
    }
  };

  const avatarSrc = removeImage ? null : (previewUrl ?? currentPresignedUrl);

  // RN MyProfileEdit 패리티 — 세로 중앙 정렬, 154px 이미지, 저장(완료)은 헤더 우측 버튼이
  // form="profile-edit-form" 속성으로 이 폼의 submit을 트리거한다 (하단 버튼 없음).
  return (
    <form
      id="profile-edit-form"
      onSubmit={e => {
        e.preventDefault();
        void handleSave();
      }}
      className="flex flex-1 flex-col items-center justify-center px-4 py-6"
    >
      {/* 아바타 + 카메라 버튼 (RN 154px + 우하단 카메라 배지) */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative h-[154px] w-[154px] shrink-0"
        aria-label="프로필 사진 변경"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-blue-300">
            <img src="/empty-profile.png" alt={user.name} className="h-full w-full rounded-full object-contain p-3" />
          </span>
        )}

        {/* 카메라 버튼: RN 패리티 — bottom-3/-right-[11px] rounded-2xl p-2, 아이콘 24px */}
        <span className="absolute -right-[11px] bottom-3 flex items-center justify-center rounded-2xl bg-white p-2 text-text-primary shadow-[0px_2px_7.5px_rgba(0,0,0,0.15)]">
          <IconDefaultCamera width={24} height={24} />
        </span>

        {/* 반영중(스피너) / 반영후(체크) — 아바타 중앙 오버레이 (Figma 2578-128231 / 128291) */}
        {imageStatus !== 'idle' && (
          <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/70">
            {imageStatus === 'uploading' ? (
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-yellow-300" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-300">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageChange}
        />
      </button>

      {avatarSrc && (
        <button
          type="button"
          onClick={handleUseDefault}
          className="mt-3 text-sub-sm text-text-tertiary transition-colors hover:text-text-secondary hover:underline"
        >
          기본 이미지로 변경
        </button>
      )}

      {/* 입력 폼: 이름 / 회사명(게스트) / 부서 / 직급 — 연락처는 정책상 미노출 (RN 이미지와 30px 간격) */}
      <div className="mt-[30px] flex w-full flex-col gap-3">
        <ProfileInput
          value={name}
          onChange={v => {
            setName(v);
            onValidityChange?.(v.trim().length > 0);
          }}
          placeholder="이름"
        />
        {isGuest && <ProfileInput value={companyName} onChange={setCompanyName} placeholder="회사명" />}
        <ProfileInput value={department} onChange={setDepartment} placeholder="부서" />
        <ProfileInput value={job} onChange={setJob} placeholder="직급" />
      </div>
    </form>
  );
}

function ProfileInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={PROFILE_FIELD_MAX_LENGTH}
      className="h-10 w-full rounded-[10px] border border-gray-200 bg-surface px-4 text-body text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
    />
  );
}

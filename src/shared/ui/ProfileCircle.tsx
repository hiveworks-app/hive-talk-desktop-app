'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { tryHeicFallback } from '@/shared/utils/heicFallback';

type ProfileCircleSize = 'sm' | 'md' | 'lg' | 'xl';

interface ProfileCircleProps {
  name: string;
  size?: ProfileCircleSize;
  storageKey?: string | null;
  className?: string;
}

const sizeStyles: Record<ProfileCircleSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-[var(--size-avatar)] w-[var(--size-avatar)]',
  lg: 'h-12 w-12', // RN ProfileImage medium(48px) 대응 — 멤버목록 헤더·설정 프로필
  xl: 'h-[154px] w-[154px]', // 프로필 보기/수정 화면 대형 아바타
};

const noImagePadding: Record<ProfileCircleSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5', // RN medium(48px) p-2.5
  xl: 'p-8', // 기본 이미지 비율을 목록(lg 58%)과 동일하게 — 154px에서 꿀벌 90px (2026-09-01 QA)
};

export function ProfileCircle({ name, size = 'sm', storageKey, className }: ProfileCircleProps) {
  const { data: presignedUrl, refetch } = usePresignedUrl(storageKey);
  const [isBroken, setIsBroken] = useState(false);
  // HEIC 변환 결과(data URL) — RN 구멍으로 올라온 HEIC 원본은 Chromium이 못 읽는다 (2026-09-02)
  const [heicSrc, setHeicSrc] = useState<string | null>(null);
  // 로드 성공 전까지 img 숨김 — 실패한 src(HEIC/만료)가 브라우저 깨진 이미지 아이콘
  // (엑스박스)으로 그려지는 것을 원천 차단, 그동안은 기본 프로필 표시 (2026-09-03 QA)
  const [showImg, setShowImg] = useState(false);
  const retryCountRef = useRef(0);

  const handleImageError = useCallback(() => {
    const continueRetry = () => {
      // HEIC 아님 → 만료 가능성: 재발급 재시도 후 소진 시 기본 이미지
      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        refetch();
      } else {
        setIsBroken(true);
      }
    };
    // 1) HEIC 폴백 먼저 — 성공 시 변환본으로 표시, 판정은 캐시되어 재시도가 싸다
    if (presignedUrl && storageKey) {
      void tryHeicFallback(storageKey, presignedUrl).then(converted => {
        if (converted) setHeicSrc(converted);
        else continueRetry();
      });
      return;
    }
    continueRetry();
  }, [presignedUrl, storageKey, refetch]);

  const hasImage = !!presignedUrl && !isBroken;

  if (hasImage) {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          !showImg && 'bg-blue-300',
          !showImg && noImagePadding[size],
          sizeStyles[size],
          className,
        )}
      >
        {!showImg && (
          <img src="/empty-profile.png" alt="" className="h-full w-full object-contain" />
        )}
        <img
          src={heicSrc ?? presignedUrl}
          alt={name}
          className={cn('absolute inset-0 h-full w-full object-cover', !showImg && 'invisible')}
          onLoad={() => setShowImg(true)}
          onError={() => {
            setShowImg(false);
            handleImageError();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-blue-300',
        sizeStyles[size],
        noImagePadding[size],
        className,
      )}
    >
      <img
        src="/empty-profile.png"
        alt={name}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

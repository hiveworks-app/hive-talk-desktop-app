'use client';

import { useState } from 'react';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import IconBlock from '@assets/icons/block.svg';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconLinkedDefault from '@assets/icons/linked-default.svg';

interface ProfileInfoSectionProps {
  name: string;
  email?: string | null;
  storageKey?: string | null;
  /** 회사명·부서·직책 등 부가 정보 라인 (falsy/공백 값은 자동 제외) */
  lines?: Array<string | null | undefined>;
  /** 협력멤버(외부) — 아바타 우하단에 연결 배지 노출 (RN IconLinkedDefault) */
  isExternal?: boolean;
  /** 내 프로필 — 이름 앞 '나' 배지 노출 */
  showMeBadge?: boolean;
  /** 아바타→이름 간격 축소(12px) — 멤버 프로필용 (RN UserProfileView gap-3, 내 프로필은 30px) */
  compactGap?: boolean;
  /** 차단 상태 — 아바타 흰색 40% dim + 이름 회색 (RN 패리티) */
  isBlocked?: boolean;
  /** 탈퇴 사용자 — 이름 회색 (RN 패리티) */
  isUnknownUser?: boolean;
}

/**
 * 프로필 본문 공용 영역 (아바타 → 이름 → 이메일 → 부가 정보).
 * 모달별 차이(나/∞ 배지, 라인 구성)는 props로만 주입한다.
 */
export function ProfileInfoSection({
  name,
  email,
  storageKey,
  lines,
  isExternal = false,
  showMeBadge = false,
  isBlocked = false,
  isUnknownUser = false,
  compactGap = false,
}: ProfileInfoSectionProps) {
  const infoLines = (lines ?? []).filter((l): l is string => !!l && l.trim().length > 0);

  // 아바타 클릭 → 전체화면 프로필 이미지 뷰어 (RN ProfileImageViewerScreen 대응, 이미지 있을 때만)
  const [isViewerOpen, setViewerOpen] = useState(false);
  const { data: fullImageUrl } = usePresignedUrl(storageKey ?? null);
  const canZoom = !!storageKey && !!fullImageUrl && !isUnknownUser;

  return (
    <div className="flex flex-col items-center">
      {/* 아바타 (+협력멤버 ∞ 배지) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => canZoom && setViewerOpen(true)}
          disabled={!canZoom}
          aria-label={canZoom ? '프로필 이미지 크게 보기' : undefined}
          className={canZoom ? 'block cursor-zoom-in' : 'block cursor-default'}
        >
          {/* RN PROFILE_IMAGE_SIZE=154 패리티 */}
          <ProfileCircle name={name} storageKey={storageKey} className="h-[154px] w-[154px]" />
        </button>
        {isBlocked && (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-white/40" />
        )}
        {/* RN UserProfileView 패리티 — IconLinkedDefault 32px, 52px 흰 원 + 그림자 */}
        {isExternal && (
          <span className="absolute bottom-0 right-0 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-[0px_2px_11px_rgba(0,0,0,0.12)]">
            <IconLinkedDefault width={32} height={32} />
          </span>
        )}
      </div>

      {/* 프로필 이미지 전체화면 뷰어 (다운로드 포함 — 채팅방 뷰어 재사용) */}
      {isViewerOpen && fullImageUrl && (
        <MediaViewer
          visible
          items={[{ id: storageKey ?? name, type: 'image', url: fullImageUrl, storageKey: storageKey ?? undefined, author: name }]}
          currentIndex={0}
          onIndexChange={() => {}}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* 이름 / 이메일 / 부가 정보 */}
      <div className={compactGap ? 'mt-3 flex w-full flex-col items-center gap-3' : 'mt-[30px] flex w-full flex-col items-center gap-3'}>
        <div className="flex items-center gap-0.5">
          {showMeBadge && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-[12px] font-semibold leading-none text-text-primary">
              나
            </span>
          )}
          <span
            className={
              isBlocked || isUnknownUser
                ? 'text-body font-semibold text-text-secondary'
                : 'text-body font-semibold text-text-primary'
            }
          >
            {name}
          </span>
          {/* 차단 아이콘 — dim·회색과 함께 3종 표기 (RN UserProfileView 패리티) */}
          {isBlocked && <IconBlock width={16} height={16} className="shrink-0 text-gray-500" />}
        </div>

        <div className="flex w-full flex-col items-center gap-1.5 text-center">
          {email && (
            <p className="w-full break-all text-body text-text-primary">
              {email}
            </p>
          )}
          {infoLines.length > 0 && (
            <div className="flex w-full flex-col gap-0.5 text-sub-lg text-text-secondary">
              {infoLines.map((line, i) => (
                <p key={i} className="w-full break-words">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

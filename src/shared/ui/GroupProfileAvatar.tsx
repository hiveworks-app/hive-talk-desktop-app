'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { tryHeicFallback } from '@/shared/utils/heicFallback';

export interface GroupAvatarUser {
  name: string;
  storageKey?: string | null;
}

interface GroupProfileAvatarProps {
  /** 표시할 참여자 (본인 제외, 최대 4명까지만 렌더). 빈 배열이면 단일 플레이스홀더. */
  users: GroupAvatarUser[];
  /** 컨테이너 크기 클래스 (기본 48px, size='list'에서만 적용). */
  className?: string;
  /** 'list'(기본, 채팅목록 48px) | 'lg'(채팅방 생성·정보 설정 94px). RN GroupProfileAvatar 패리티. */
  size?: 'list' | 'lg';
}

/**
 * 채팅방 그룹 프로필 — 참여자 수에 따라 1/2/3/4명 레이아웃 자동 적용.
 * RN ChatListProfileAvatar(list 사이즈)의 절대좌표 겹침 레이아웃을 웹으로 포팅. (정책 chat.md)
 */
export function GroupProfileAvatar({ users, className, size = 'list' }: GroupProfileAvatarProps) {
  const display = users.slice(0, 4);

  if (size === 'lg') {
    return <LargeGroupAvatar display={display} />;
  }

  const container = cn('relative h-12 w-12 shrink-0', className);

  if (display.length <= 1) {
    return (
      <div className={container}>
        <AvatarImg user={display[0]} />
      </div>
    );
  }

  if (display.length === 2) {
    return (
      <div className={container}>
        <span className="absolute left-0 top-0 h-[30px] w-[30px] overflow-hidden rounded-full">
          <AvatarImg user={display[0]} />
        </span>
        <span className="absolute bottom-0 right-0 h-[30px] w-[30px] overflow-hidden rounded-full border-2 border-white">
          <AvatarImg user={display[1]} />
        </span>
      </div>
    );
  }

  if (display.length === 3) {
    return (
      <div className={container}>
        <span className="absolute bottom-0 left-0 h-[26px] w-[26px] overflow-hidden rounded-full">
          <AvatarImg user={display[1]} />
        </span>
        <span className="absolute bottom-0 right-0 h-[27px] w-[27px] overflow-hidden rounded-full border-2 border-white">
          <AvatarImg user={display[2]} />
        </span>
        <span className="absolute left-[10px] top-0 z-10 h-[27px] w-[27px] overflow-hidden rounded-full border-2 border-white">
          <AvatarImg user={display[0]} />
        </span>
      </div>
    );
  }

  // 4명 이상: 2x2 그리드
  return (
    <div className={cn('flex flex-col gap-0.5', container)}>
      <div className="flex gap-0.5">
        <span className="h-[23px] w-[23px] overflow-hidden rounded-full">
          <AvatarImg user={display[0]} />
        </span>
        <span className="h-[23px] w-[23px] overflow-hidden rounded-full">
          <AvatarImg user={display[1]} />
        </span>
      </div>
      <div className="flex gap-0.5">
        <span className="h-[23px] w-[23px] overflow-hidden rounded-full">
          <AvatarImg user={display[2]} />
        </span>
        <span className="h-[23px] w-[23px] overflow-hidden rounded-full">
          <AvatarImg user={display[3]} />
        </span>
      </div>
    </div>
  );
}

/**
 * 대형(94px) 그룹 아바타 — 채팅방 생성/정보 설정 화면용.
 * RN GroupProfileAvatar(RoomInfoSetupForm)의 1~4명 레이아웃을 좌표 그대로 포팅.
 * 1명: 단일 80px / 2명: 58px 대각선 겹침 / 3명: 삼각형 / 4명+: 46px 2x2 그리드.
 */
function LargeGroupAvatar({ display }: { display: GroupAvatarUser[] }) {
  if (display.length <= 1) {
    return (
      <div className="relative flex h-[94px] w-[94px] items-center justify-center">
        <span className="h-20 w-20 overflow-hidden rounded-full">
          <AvatarImg user={display[0]} />
        </span>
      </div>
    );
  }

  if (display.length === 2) {
    return (
      <div className="relative h-[94px] w-[94px]">
        <span className="absolute left-0 top-0 h-[58px] w-[58px] overflow-hidden rounded-full">
          <AvatarImg user={display[0]} />
        </span>
        <span className="absolute left-9 top-[35px] h-[58px] w-[58px] overflow-hidden rounded-full border-[3.5px] border-white">
          <AvatarImg user={display[1]} />
        </span>
      </div>
    );
  }

  if (display.length === 3) {
    return (
      <div className="flex h-[94px] w-[94px] flex-col items-center">
        <span className="z-10 h-[54px] w-[54px] overflow-hidden rounded-full border-[3.4px] border-white">
          <AvatarImg user={display[0]} />
        </span>
        <div className="-mt-3.5 flex flex-row">
          <span className="h-[50px] w-[50px] overflow-hidden rounded-full">
            <AvatarImg user={display[1]} />
          </span>
          <span className="-ml-2.5 h-[54px] w-[54px] overflow-hidden rounded-full border-[3.4px] border-white">
            <AvatarImg user={display[2]} />
          </span>
        </div>
      </div>
    );
  }

  // 4명 이상: 2x2 그리드 (slice로 이미 4명까지만)
  return (
    <div className="w-[94px]">
      <div className="flex flex-row gap-0.5">
        <span className="h-[46px] w-[46px] overflow-hidden rounded-full">
          <AvatarImg user={display[0]} />
        </span>
        <span className="h-[46px] w-[46px] overflow-hidden rounded-full">
          <AvatarImg user={display[1]} />
        </span>
      </div>
      <div className="mt-0.5 flex flex-row gap-0.5">
        <span className="h-[46px] w-[46px] overflow-hidden rounded-full">
          <AvatarImg user={display[2]} />
        </span>
        {display[3] && (
          <span className="h-[46px] w-[46px] overflow-hidden rounded-full">
            <AvatarImg user={display[3]} />
          </span>
        )}
      </div>
    </div>
  );
}

/** 단일 아바타 이미지 — presigned URL 개별 구독 + 실패 시 HEIC 변환→재시도→플레이스홀더. */
function AvatarImg({ user }: { user?: GroupAvatarUser }) {
  const { data: url, refetch } = usePresignedUrl(user?.storageKey);
  const [isBroken, setIsBroken] = useState(false);
  // HEIC 변환 결과 — ProfileCircle과 동일 폴백 (그룹 아바타만 빠져 있던 누락분, 2026-09-03)
  const [heicSrc, setHeicSrc] = useState<string | null>(null);
  // 로드 성공 전까지 img 숨김 — 실패한 src가 깨진 이미지 아이콘(엑스박스)으로 그려지지 않게
  const [showImg, setShowImg] = useState(false);
  const retryCountRef = useRef(0);
  const storageKey = user?.storageKey;

  const handleError = useCallback(() => {
    const continueRetry = () => {
      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        refetch();
      } else {
        setIsBroken(true);
      }
    };
    if (url && storageKey) {
      void tryHeicFallback(storageKey, url).then(converted => {
        if (converted) setHeicSrc(converted);
        else continueRetry();
      });
      return;
    }
    continueRetry();
  }, [url, storageKey, refetch]);

  if (url && !isBroken) {
    return (
      <div className="relative flex h-full w-full items-center justify-center rounded-full bg-blue-300">
        {!showImg && (
          <img src="/empty-profile.png" alt="" className="h-4/5 w-4/5 object-contain" />
        )}
        <img
          src={heicSrc ?? url}
          alt={user?.name ?? ''}
          onLoad={() => setShowImg(true)}
          onError={() => {
            setShowImg(false);
            handleError();
          }}
          className={cn('absolute inset-0 h-full w-full rounded-full object-cover', !showImg && 'invisible')}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-300">
      <img src="/empty-profile.png" alt={user?.name ?? ''} className="h-4/5 w-4/5 object-contain" />
    </div>
  );
}

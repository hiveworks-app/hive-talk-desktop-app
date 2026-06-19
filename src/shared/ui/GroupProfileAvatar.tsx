'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';

export interface GroupAvatarUser {
  name: string;
  storageKey?: string | null;
}

interface GroupProfileAvatarProps {
  /** 표시할 참여자 (본인 제외, 최대 4명까지만 렌더). 빈 배열이면 단일 플레이스홀더. */
  users: GroupAvatarUser[];
  /** 컨테이너 크기 클래스 (기본 48px). */
  className?: string;
}

/**
 * 채팅방 그룹 프로필 — 참여자 수에 따라 1/2/3/4명 레이아웃 자동 적용.
 * RN ChatListProfileAvatar(list 사이즈)의 절대좌표 겹침 레이아웃을 웹으로 포팅. (정책 chat.md)
 */
export function GroupProfileAvatar({ users, className }: GroupProfileAvatarProps) {
  const container = cn('relative h-12 w-12 shrink-0', className);
  const display = users.slice(0, 4);

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

/** 단일 아바타 이미지 — presigned URL 개별 구독 + 실패 시 재시도 후 플레이스홀더. */
function AvatarImg({ user }: { user?: GroupAvatarUser }) {
  const { data: url, refetch } = usePresignedUrl(user?.storageKey);
  const [isBroken, setIsBroken] = useState(false);
  const retryCountRef = useRef(0);

  const handleError = useCallback(() => {
    if (retryCountRef.current < 2) {
      retryCountRef.current += 1;
      refetch();
    } else {
      setIsBroken(true);
    }
  }, [refetch]);

  if (url && !isBroken) {
    return (
      <img
        src={url}
        alt={user?.name ?? ''}
        onError={handleError}
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100">
      <img src="/empty-profile.png" alt={user?.name ?? ''} className="h-4/5 w-4/5 object-contain" />
    </div>
  );
}

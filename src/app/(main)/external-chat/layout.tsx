'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { useRoomIdParam } from '@/shared/hooks/useRoomIdParam';
import { ExternalChatSidebar } from '@/widgets/chat-room-list/ExternalChatSidebar';

function ExternalChatLayoutInner({ children }: { children: React.ReactNode }) {
  const roomId = useRoomIdParam();
  const pathname = usePathname();
  const hasActiveRoom = !!roomId || pathname === '/external-chat/new';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 사내채팅 레이아웃과 동일 정책 — md 이상에선 목록(320px)+방 동시 표시, 좁으면 방 단독
          (사용자 결정 2026-08-26 — 상세 근거는 chat/layout.tsx 주석 참조) */}
      <div
        className={cn(
          'h-full shrink-0 overflow-hidden',
          hasActiveRoom
            ? 'w-0 opacity-0 transition-[width,opacity] duration-200 md:w-80 md:opacity-100'
            : 'w-full',
        )}
      >
        <div className={cn('h-full', hasActiveRoom ? 'w-80' : 'w-full')}>
          <ExternalChatSidebar />
        </div>
      </div>
      <div className={cn('min-w-0 flex-1', hasActiveRoom ? 'flex' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}

export default function ExternalChatLayout({ children }: { children: React.ReactNode }) {
  // useSearchParams(roomId)의 정적 프리렌더 경계 (chat/layout.tsx와 동일)
  return (
    <Suspense fallback={null}>
      <ExternalChatLayoutInner>{children}</ExternalChatLayoutInner>
    </Suspense>
  );
}

'use client';

import { useParams, usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { ExternalChatSidebar } from '@/widgets/chat-room-list/ExternalChatSidebar';

export default function ExternalChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const hasActiveRoom = !!params?.roomId || pathname === '/external-chat/new';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 사내채팅 레이아웃과 동일 정책 — 방이 열리면 창 폭 무관 '방 단독' (사용자 결정 2026-08-25) */}
      <div className={cn('h-full shrink-0', hasActiveRoom ? 'hidden' : 'w-full')}>
        <ExternalChatSidebar />
      </div>
      <div className={cn('min-w-0 flex-1', hasActiveRoom ? 'flex' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}

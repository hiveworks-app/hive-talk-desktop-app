'use client';

import { useParams, usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { ChatRoomListSidebar } from '@/widgets/chat-room-list/ChatRoomListSidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const hasActiveRoom = !!params?.roomId || pathname === '/chat/new';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 채팅방 목록 사이드바 — 방이 열리면 좁은 창에선 숨기고, md(768px) 이상에선 고정폭(320px)으로
          방과 동시 표시한다 (사용자 결정 2026-08-26: "넓을 때만 동시 표시 + 경계 부드럽게" — 2026-08-25의
          '방 단독' 결정을 갱신). 경계 전환이 팝으로 보이지 않게 width/opacity 200ms 전환하고, 내부는
          고정폭 래퍼로 감싸 전환 중 목록이 찌그러지지 않는다. 언마운트 없이 숨겨 목록 스크롤·상태를 보존한다. */}
      <div
        className={cn(
          'h-full shrink-0 overflow-hidden',
          hasActiveRoom
            ? 'w-0 opacity-0 transition-[width,opacity] duration-200 md:w-80 md:opacity-100'
            : 'w-full',
        )}
      >
        <div className={cn('h-full', hasActiveRoom ? 'w-80' : 'w-full')}>
          <ChatRoomListSidebar />
        </div>
      </div>
      {/* 채팅방 콘텐츠 — 목록 화면에서는 숨김 (목록↔방은 RN처럼 화면 전환으로만 이동) */}
      <div className={cn('min-w-0 flex-1', hasActiveRoom ? 'flex' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}

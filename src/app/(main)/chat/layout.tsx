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
      {/* 채팅방 목록 사이드바 — 방이 열리면 창 폭과 무관하게 숨김 (사용자 결정 2026-08-25:
          768px 반응형 분기는 리사이즈 때 사이드바가 나타났다 사라져 데스크톱에선 오동작처럼 보임).
          언마운트하지 않고 hidden 처리해 목록 스크롤·상태를 보존한다. */}
      <div className={cn('h-full shrink-0', hasActiveRoom ? 'hidden' : 'w-full')}>
        <ChatRoomListSidebar />
      </div>
      {/* 채팅방 콘텐츠 — 목록 화면에서는 숨김 (목록↔방은 RN처럼 화면 전환으로만 이동) */}
      <div className={cn('min-w-0 flex-1', hasActiveRoom ? 'flex' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}

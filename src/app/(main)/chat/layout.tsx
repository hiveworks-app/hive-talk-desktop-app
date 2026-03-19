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
      {/* 채팅방 목록 사이드바 */}
      <div
        className={cn(
          'h-full shrink-0',
          hasActiveRoom
            ? 'hidden md:block md:w-[280px]'
            : 'w-full md:w-[280px]',
        )}
      >
        <ChatRoomListSidebar />
      </div>
      {/* 채팅방 콘텐츠 */}
      <div
        className={cn(
          'min-w-0 flex-1',
          hasActiveRoom ? 'flex' : 'hidden md:flex',
        )}
      >
        {children}
      </div>
    </div>
  );
}

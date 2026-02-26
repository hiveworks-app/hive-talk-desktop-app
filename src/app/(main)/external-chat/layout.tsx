'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { ExternalChatSidebar } from '@/widgets/chat-room-list/ExternalChatSidebar';

export default function ExternalChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const hasActiveRoom = !!params?.roomId;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className={cn(
          'h-full shrink-0',
          hasActiveRoom
            ? 'hidden md:block md:w-[280px]'
            : 'w-full md:w-[280px]',
        )}
      >
        <ExternalChatSidebar />
      </div>
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

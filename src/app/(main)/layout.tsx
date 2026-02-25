'use client';

import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <div className="relative flex h-dvh overflow-hidden">
        <AppNav />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WebSocketProvider>
  );
}

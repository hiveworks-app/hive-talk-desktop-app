'use client';

import { WebSocketProvider } from '@/shared/websocket/WebSocketContext';
import { AppNav } from '@/widgets/nav/AppNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <div className="relative flex h-dvh overflow-hidden">
        {/* Electron: 창 상단 드래그 영역 (타이틀바 대체) */}
        <div className="electron-drag absolute top-0 left-0 right-0 h-8 z-50" />
        <AppNav />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WebSocketProvider>
  );
}

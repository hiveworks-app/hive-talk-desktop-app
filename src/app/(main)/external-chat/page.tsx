'use client';

import { useRoomIdParam } from '@/shared/hooks/useRoomIdParam';
import { ChatRoomView } from '@/widgets/chat-room/ChatRoomView';

// 정적 export 전환 — 동적 세그먼트(/external-chat/[roomId]) 대신 ?roomId= 쿼리로 방을 연다.
// Suspense 경계는 external-chat/layout.tsx가 제공.
export default function ExternalChatPage() {
  const roomId = useRoomIdParam();

  if (roomId) {
    return <ChatRoomView routePrefix="/external-chat" showNextMessage />;
  }
  return (
    <main className="flex flex-1 items-center justify-center bg-gray-100">
      <p className="text-text-tertiary">채팅방을 선택하세요</p>
    </main>
  );
}

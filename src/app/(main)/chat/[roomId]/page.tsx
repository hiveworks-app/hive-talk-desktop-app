'use client';

import { ChatRoomView } from '@/widgets/chat-room/ChatRoomView';

export default function ChatRoomPage() {
  return <ChatRoomView routePrefix="/chat" showNextMessage />;
}

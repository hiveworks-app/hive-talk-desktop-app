'use client';

import { ChatRoomView } from '@/widgets/chat-room/ChatRoomView';

export default function NewChatRoomPage() {
  return <ChatRoomView routePrefix="/chat" showNextMessage />;
}

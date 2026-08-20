'use client';

import { ChatRoomView } from '@/widgets/chat-room/ChatRoomView';

export default function NewExternalChatRoomPage() {
  return <ChatRoomView routePrefix="/external-chat" showNextMessage />;
}

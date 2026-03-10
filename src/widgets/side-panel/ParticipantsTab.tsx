'use client';

import { useQuery } from '@tanstack/react-query';
import { getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface ParticipantsTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
}

export function ParticipantsTab({ roomId, channelType }: ParticipantsTabProps) {
  const { data: participants = [], isLoading } = useQuery(
    getSidePanelParticipantsQuery(roomId, channelType),
  );

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  return (
    <div className="py-1">
      <div className="px-4 py-2 text-sub-sm text-text-tertiary">
        참여자 {participants.length}명
      </div>
      {participants.map(p => (
        <div key={p.userId} className="flex items-center gap-3 px-4 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sub-sm font-medium text-text-secondary">
            {p.name.charAt(0)}
          </div>
          <span className="text-sub text-text-primary">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

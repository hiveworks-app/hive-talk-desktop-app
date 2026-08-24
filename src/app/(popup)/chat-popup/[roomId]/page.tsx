'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { bootstrapPopupRoom } from '@/features/chat-room/bootstrapPopupRoom';
import { ChatRoomView } from '@/widgets/chat-room/ChatRoomView';

/**
 * 멀티 채팅창(팝업) — 사내채팅(DM/GM) 대화 화면 단독.
 *
 * 방 메타(chatRoomInfo)를 먼저 채운 뒤에만 ChatRoomView를 마운트한다.
 * ChatRoomView는 스토어가 비어 있으면 목록으로 리다이렉트하는데 팝업엔 목록이 없기 때문.
 * 실패해도 창을 닫지 않고 사유를 표시한다 — 닫아버리면 원인을 확인할 방법이 없다.
 */
export default function ChatPopupPage() {
  const params = useParams();
  const roomId = params?.roomId as string | undefined;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (!roomId) return;
    bootstrapPopupRoom(roomId, queryClient)
      .then(found => {
        if (found) {
          setStatus('ready');
          return;
        }
        setErrorDetail('채팅방 목록에서 이 방을 찾지 못했어요.');
        setStatus('error');
      })
      .catch((err: unknown) => {
        console.error('[popup] 방 정보를 불러오지 못했습니다:', err);
        setErrorDetail(err instanceof Error ? err.message : '채팅방 정보를 불러오지 못했어요.');
        setStatus('error');
      });
  }, [roomId, queryClient]);

  if (!roomId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <span className="text-body font-medium text-text-primary">채팅방을 열지 못했어요.</span>
        <span className="text-sub-sm text-text-secondary">주소에 채팅방 정보가 없어요.</span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-400" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <span className="text-body font-medium text-text-primary">채팅방을 열지 못했어요.</span>
        <span className="text-sub-sm text-text-secondary">{errorDetail}</span>
      </div>
    );
  }

  return <ChatRoomView routePrefix="/chat" showNextMessage isPopup />;
}

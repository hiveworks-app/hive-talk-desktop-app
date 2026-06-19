'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { apiUpdateEMRoomTitle, apiUpdateGMRoomTitle } from './api';

/**
 * 채팅방 제목 변경 (GM/EM). DM은 제목=상대방 이름이라 변경 불가.
 * 발신 측: REST PUT 호출 후 내 캐시(현재 방 zustand + 룸리스트)를 낙관적 갱신.
 * 다른 참여자는 SUBMIT_ROOM_TITLE_UPDATE 브로드캐스트로 handlePublish에서 갱신됨.
 * (RN useChangeRoomTitle 패리티)
 */
export function useChangeRoomTitle() {
  const queryClient = useQueryClient();
  const roomId = useChatRoomInfo(s => s.roomId);
  const channelType = useChatRoomInfo(s => s.channelType);
  const setChatRoomInfo = useChatRoomInfo(s => s.setChatRoomInfo);

  return useMutation({
    mutationFn: (title: string) => {
      if (!roomId) return Promise.reject(new Error('roomId가 없습니다.'));
      if (channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE) {
        return apiUpdateEMRoomTitle(roomId, title);
      }
      return apiUpdateGMRoomTitle(roomId, title);
    },
    onSuccess: (_, title) => {
      setChatRoomInfo({ roomName: title });
      const listKey =
        channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? EM_ROOM_LIST_KEY : GM_ROOM_LIST_KEY;
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

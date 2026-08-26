'use client';

import { useQuery } from '@tanstack/react-query';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHNANNEL_URL_TYPE, WebSocketChannelUrlTypes } from '@/shared/types/websocket';
import { toSafeNumber } from '@/shared/utils/utils';
import { USER_TYPE } from '@/shared/types/user';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { apiGetChatRoomList } from './api';
import { GetChatRoomListItemType } from './type';

async function fetchChatRoomList(type: WebSocketChannelUrlTypes) {
  const res = await apiGetChatRoomList(type);
  const rawItems = res.payload.items as GetChatRoomListItemType[];

  // 지금 보고 있는 방 = unread 0 불변식 (RN 패리티) — 재연결 직후 스냅샷이
  // VIEW_IN 서버 처리 전의 unread=N으로 열린 방 뱃지를 되살리는 것 방지.
  // currentRoomId는 목록 복귀 후에도 잔존하므로 방 화면이 실제 마운트된 경우만 클램프
  // (아니면 떠난 방의 새 메시지 배지가 refetch마다 0으로 지워진다 — 2026-08-26 리뷰)
  const { currentRoomId: activeRoomId, isRoomViewActive } = useChatRoomRuntimeStore.getState();
  const shouldClamp = isRoomViewActive && !!activeRoomId;
  return rawItems.map(item => ({
    ...item,
    notReadCount:
      shouldClamp && item.roomModel?.roomId === activeRoomId
        ? 0
        : toSafeNumber(item.notReadCount, 0),
  }));
}

export const fetchDMRoomList = () => fetchChatRoomList(WS_CHNANNEL_URL_TYPE.DM_CHANNEL_URL);
export const fetchGMRoomList = () => fetchChatRoomList(WS_CHNANNEL_URL_TYPE.GM_CHANNEL_URL);
export const fetchEMRoomList = () => fetchChatRoomList(WS_CHNANNEL_URL_TYPE.EM_CHANNEL_URL);

const COMMON_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 60,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false,
} as const;

export const useGetDMRoomList = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: DM_ROOM_LIST_KEY,
    queryFn: fetchDMRoomList,
    // 게스트는 사내 목록 미조회 (RN ORG_MEMBER 게이팅 패리티 — 불필요 호출 방지)
    enabled: !!user?.id && user.userType === USER_TYPE.ORG_MEMBER,
    ...COMMON_QUERY_OPTIONS,
  });
};

export const useGetGMRoomList = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: GM_ROOM_LIST_KEY,
    queryFn: fetchGMRoomList,
    enabled: !!user?.id && user.userType === USER_TYPE.ORG_MEMBER,
    ...COMMON_QUERY_OPTIONS,
  });
};

export const useGetEMRoomList = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: EM_ROOM_LIST_KEY,
    queryFn: fetchEMRoomList,
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTIONS,
  });
};

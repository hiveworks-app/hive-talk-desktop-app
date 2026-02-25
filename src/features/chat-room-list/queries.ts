'use client';

import { useQuery } from '@tanstack/react-query';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHNANNEL_URL_TYPE, WebSocketChannelUrlTypes } from '@/shared/types/websocket';
import { toSafeNumber } from '@/shared/utils/utils';
import { useAuthStore } from '@/store/auth/authStore';
import { apiGetChatRoomList } from './api';
import { GetChatRoomListItemType } from './type';

async function fetchChatRoomList(type: WebSocketChannelUrlTypes) {
  const res = await apiGetChatRoomList(type);
  const rawItems = res.payload.items as GetChatRoomListItemType[];

  return rawItems.map(item => ({
    ...item,
    notReadCount: toSafeNumber(item.notReadCount, 0),
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
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTIONS,
  });
};

export const useGetGMRoomList = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: GM_ROOM_LIST_KEY,
    queryFn: fetchGMRoomList,
    enabled: !!user?.id,
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

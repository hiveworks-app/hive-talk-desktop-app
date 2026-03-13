import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROOM_NOTICE_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import {
  apiCreateNotice,
  apiDeleteNotice,
  apiGetNotice,
  apiUpdateNoticeDisplay,
} from './api';
import type { NoticeDisplayRequest, NoticeModel, NoticeRequest } from './type';

/** 공지사항 조회 (DM/GM만 지원) */
export const useNoticeQuery = (roomId: string, channelType: WebSocketChannelTypes) => {
  const isSupported =
    channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE ||
    channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE;

  return useQuery<NoticeModel | null>({
    queryKey: ROOM_NOTICE_KEY(roomId, channelType),
    queryFn: async () => {
      const res = await apiGetNotice(roomId, channelType);
      return res.payload ?? null;
    },
    enabled: !!roomId && isSupported,
  });
};

/** 공지사항 생성 */
export const useCreateNoticeMutation = (
  roomId: string,
  channelType: WebSocketChannelTypes,
) => {
  const queryClient = useQueryClient();

  return useMutation<NoticeModel, Error, NoticeRequest>({
    mutationFn: async body => {
      const res = await apiCreateNotice(roomId, channelType, body);
      return res.payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_NOTICE_KEY(roomId, channelType) });
    },
  });
};

/** 공지사항 삭제 */
export const useDeleteNoticeMutation = (
  roomId: string,
  channelType: WebSocketChannelTypes,
) => {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { noticeId: number }>({
    mutationFn: async ({ noticeId }) => {
      const res = await apiDeleteNotice(roomId, channelType, noticeId);
      return res.payload;
    },
    onSuccess: () => {
      queryClient.setQueryData(ROOM_NOTICE_KEY(roomId, channelType), null);
    },
  });
};

/** 공지사항 표시 상태 변경 (접기/펼치기) */
export const useUpdateNoticeDisplayMutation = (
  roomId: string,
  channelType: WebSocketChannelTypes,
) => {
  const queryClient = useQueryClient();

  return useMutation<NoticeModel, Error, { noticeId: number; body: NoticeDisplayRequest }>({
    mutationFn: async ({ noticeId, body }) => {
      const res = await apiUpdateNoticeDisplay(roomId, channelType, noticeId, body);
      return res.payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_NOTICE_KEY(roomId, channelType) });
    },
  });
};

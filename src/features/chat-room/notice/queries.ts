import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROOM_NOTICE_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import {
  apiCreateNotice,
  apiDeleteNotice,
  apiGetNotice,
  apiUpdateNotice,
  apiUpdateNoticeDisplay,
} from './api';
import { normalizeNoticeModel } from './noticeUtils';
import type { NoticeDisplayRequest, NoticeModel, NoticeRequest } from './type';

/** 공지사항 조회 (DM/GM/EM 지원 — RN 패리티) */
export const useNoticeQuery = (roomId: string, channelType: WebSocketChannelTypes) => {
  const isSupported =
    channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE ||
    channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ||
    channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE;

  return useQuery<NoticeModel | null>({
    queryKey: ROOM_NOTICE_KEY(roomId, channelType),
    queryFn: async () => {
      const res = await apiGetNotice(roomId, channelType);
      // v1(legacy) 응답 하위호환 정규화 — 마이그레이션 이전 등록 공지 대비 (RN 패리티)
      return normalizeNoticeModel(res.payload);
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

  return useMutation<NoticeModel | null, Error, NoticeRequest>({
    mutationFn: async body => {
      const res = await apiCreateNotice(roomId, channelType, body);
      return normalizeNoticeModel(res.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_NOTICE_KEY(roomId, channelType) });
    },
  });
};

/** 공지사항 수정 (등록자 본인만 가능) */
export const useUpdateNoticeMutation = (
  roomId: string,
  channelType: WebSocketChannelTypes,
) => {
  const queryClient = useQueryClient();

  return useMutation<NoticeModel | null, Error, { noticeId: number; body: NoticeRequest }>({
    mutationFn: async ({ noticeId, body }) => {
      const res = await apiUpdateNotice(roomId, channelType, noticeId, body);
      return normalizeNoticeModel(res.payload);
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

  return useMutation<null, Error, { noticeId: number; body: NoticeDisplayRequest }>({
    mutationFn: async ({ noticeId, body }) => {
      const res = await apiUpdateNoticeDisplay(roomId, channelType, noticeId, body);
      return res.payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_NOTICE_KEY(roomId, channelType) });
    },
  });
};

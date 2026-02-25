import { infiniteQueryOptions } from '@tanstack/react-query';
import {
  ROOM_BEFORE_ATTACHMENT_KEY,
  ROOM_BEFORE_FILE_KEY,
  ROOM_PARTICIPANTS_KEY,
} from '@/shared/config/queryKeys';
import { MediaListType } from '@/shared/types/media';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { convertedMediaList } from '@/shared/utils/chatSidePanelUtils';
import {
  apiGetBeforeSidePanelAttachment,
  apiGetBeforeSidePanelFile,
  apiGetSidePanelParticipants,
} from './api';

export const getSidePanelBeforeAttachmentQuery = (
  roomId: string,
  initialLastMessageId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) =>
  infiniteQueryOptions({
    queryKey: ROOM_BEFORE_ATTACHMENT_KEY(roomId, channelType),
    initialPageParam: initialLastMessageId,
    queryFn: async ({ pageParam }) => {
      const res = await apiGetBeforeSidePanelAttachment({
        roomId,
        lastMessageId: pageParam,
        messageContentType: ['IMAGE', 'MEDIA'],
        beforeCount: 10,
        channelType,
      });

      const cachedAttachments = res.payload.items;
      const convertedMediaData: MediaListType[] = convertedMediaList(cachedAttachments);

      return convertedMediaData;
    },
    getNextPageParam: lastPage => {
      if (!lastPage || lastPage.length < 10) return undefined;
      const lastItem = lastPage[lastPage.length - 1];
      return lastItem?.messageId;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const getSidePanelBeforeFileQuery = (
  roomId: string,
  initialLastMessageId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) =>
  infiniteQueryOptions({
    queryKey: ROOM_BEFORE_FILE_KEY(roomId, channelType),
    initialPageParam: initialLastMessageId,
    queryFn: async ({ pageParam }) => {
      const res = await apiGetBeforeSidePanelFile({
        roomId,
        lastMessageId: pageParam,
        messageContentType: ['FILE'],
        beforeCount: 10,
        channelType,
      });

      const cachedFiles = res.payload.items;
      const convertedFileData: MediaListType[] = convertedMediaList(cachedFiles);

      return convertedFileData;
    },
    getNextPageParam: lastPage => {
      if (!lastPage || lastPage.length < 10) return undefined;
      const lastItem = lastPage[lastPage.length - 1];
      return lastItem?.messageId;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const getSidePanelParticipantsQuery = (
  roomId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) => ({
  queryKey: ROOM_PARTICIPANTS_KEY(roomId, channelType),
  queryFn: async () => {
    const res = await apiGetSidePanelParticipants(roomId, channelType);
    return res.payload.items;
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: 1,
});

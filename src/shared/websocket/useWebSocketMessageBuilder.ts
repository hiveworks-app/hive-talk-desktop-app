import { useCallback, useMemo } from 'react';
import { CHAT_AFTER_SIZE, CHAT_BEFORE_SIZE } from '@/shared/config/constants';
import {
  DeleteMessageProps,
  ExitMessageRoomProps,
  FetchMessageProps,
  InviteMessageProps,
  RemoveTagMessageProps,
  SubscribeMessageProps,
  UpdateTagToMessageProps,
  ViewInRoomMessageProps,
  WS_MESSAGE_CONTENT_TYPE,
  WS_OPERATION,
} from '@/shared/types/websocket';
import type { BuildPublishMessageParams, WebSocketMessageBuilderProps } from './type';

export type { BuildPublishMessageParams, WebSocketMessageBuilderProps } from './type';

export const useWebSocketMessageBuilder = ({ type, channelId }: WebSocketMessageBuilderProps) => {
  const resolveChanneType = useCallback((override?: string) => override ?? type, [type]);
  const resolveChannelId = useCallback((override?: string) => override ?? channelId, [channelId]);

  const buildSubscribeMessage = useCallback(
    ({ channelIdOverride, channelTypeOverride }: SubscribeMessageProps) => ({
      operationType: WS_OPERATION.SUB,
      channelType: resolveChanneType(channelTypeOverride),
      channelId: resolveChannelId(channelIdOverride),
      payload: null,
    }),
    [resolveChanneType, resolveChannelId],
  );

  const buildInviteMessage = useCallback(
    ({ inviteUserId, inviteUserIdArray, channelIdOverride }: InviteMessageProps) => ({
      operationType: WS_OPERATION.INVITE,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: inviteUserId ? inviteUserId : inviteUserIdArray,
    }),
    [type, resolveChannelId],
  );

  const buildViewInMessageRoom = useCallback(
    ({ channelIdOverride }: ViewInRoomMessageProps) => ({
      operationType: WS_OPERATION.VIEW_IN_MESSAGE_ROOM,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: null,
    }),
    [type, resolveChannelId],
  );

  const buildViewOutMessageRoom = useCallback(
    ({ channelIdOverride }: ViewInRoomMessageProps) => ({
      operationType: WS_OPERATION.VIEW_OUT_MESSAGE_ROOM,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: null,
    }),
    [type, resolveChannelId],
  );

  const buildFetchBeforeMessage = useCallback(
    ({ currentMessage, isInclusive = false, channelIdOverride }: FetchMessageProps) => ({
      operationType: WS_OPERATION.FETCH_MESSAGE_BEFORE,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: {
        currentMessage,
        condition: { count: CHAT_BEFORE_SIZE, isInclusive },
      },
    }),
    [type, resolveChannelId],
  );

  const buildFetchAfterMessage = useCallback(
    ({ currentMessage, isInclusive = false, channelIdOverride }: FetchMessageProps) => ({
      operationType: WS_OPERATION.FETCH_MESSAGE_AFTER,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: {
        currentMessage,
        condition: { count: CHAT_AFTER_SIZE, isInclusive },
      },
    }),
    [type, resolveChannelId],
  );

  const buildReadMessage = useCallback(
    () => ({
      operationType: WS_OPERATION.READ_MESSAGE,
      channelType: type,
      channelId,
      payload: null,
    }),
    [type, channelId],
  );

  const buildPublishMessage = useCallback(
    (params: BuildPublishMessageParams) => {
      const { channelIdOverride, tagList = [] } = params;
      const common = {
        operationType: WS_OPERATION.PUB,
        channelType: type,
        channelId: resolveChannelId(channelIdOverride),
      };

      if (params.type === WS_MESSAGE_CONTENT_TYPE.TEXT) {
        return {
          ...common,
          payload: {
            messageContentType: WS_MESSAGE_CONTENT_TYPE.TEXT,
            tagList,
            payload: { content: params.content },
          },
        };
      }

      return {
        ...common,
        payload: {
          messageContentType: params.type,
          tagList,
          payload: { fileId: params.fileId, items: params.items },
        },
      };
    },
    [type, resolveChannelId],
  );

  const buildDeleteMessage = useCallback(
    ({ messageId }: DeleteMessageProps) => ({
      operationType: WS_OPERATION.DELETE_MESSAGE,
      channelType: type,
      channelId,
      payload: messageId,
    }),
    [type, channelId],
  );

  const buildAddTagToMessage = useCallback(
    ({ messageId, tagIdList }: UpdateTagToMessageProps) => ({
      operationType: WS_OPERATION.ADD_TAG,
      channelType: type,
      channelId,
      payload: { messageId, tagIdList },
    }),
    [type, channelId],
  );

  const buildRemoveTagToMessage = useCallback(
    ({ messageId, taggingIdList }: RemoveTagMessageProps) => ({
      operationType: WS_OPERATION.REMOVE_TAG,
      channelType: type,
      channelId,
      payload: { messageId, taggingIdList },
    }),
    [type, channelId],
  );

  const buildExitMessageRoom = useCallback(
    ({ channelIdOverride }: ExitMessageRoomProps) => ({
      operationType: WS_OPERATION.EXIT_MESSAGE_ROOM,
      channelType: type,
      channelId: resolveChannelId(channelIdOverride),
      payload: null,
    }),
    [type, resolveChannelId],
  );

  return useMemo(
    () => ({
      buildSubscribeMessage,
      buildInviteMessage,
      buildViewInMessageRoom,
      buildViewOutMessageRoom,
      buildFetchBeforeMessage,
      buildFetchAfterMessage,
      buildReadMessage,
      buildPublishMessage,
      buildDeleteMessage,
      buildAddTagToMessage,
      buildRemoveTagToMessage,
      buildExitMessageRoom,
    }),
    [
      buildSubscribeMessage, buildInviteMessage,
      buildViewInMessageRoom, buildViewOutMessageRoom,
      buildFetchBeforeMessage, buildFetchAfterMessage,
      buildReadMessage, buildPublishMessage,
      buildDeleteMessage, buildAddTagToMessage,
      buildRemoveTagToMessage, buildExitMessageRoom,
    ],
  );
};

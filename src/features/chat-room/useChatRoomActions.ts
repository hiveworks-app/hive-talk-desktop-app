'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { useChatMediaUpload } from '@/features/chat-room/useChatMediaUpload';
import {
  WS_MESSAGE_CONTENT_TYPE,
  RemoveTagMessageProps,
  UpdateTagToMessageProps,
} from '@/shared/types/websocket';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

type ChatScrollDirection = 'before' | 'after';

export const useChatRoomActions = () => {
  const queryClient = useQueryClient();
  const { send } = useAppWebSocket();
  const { channelType } = useChatRoomInfo();
  const currentRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const setLoading = useChatRoomRuntimeStore(s => s.setLoading);
  const setNextMyTags = useChatRoomRuntimeStore(s => s.setNextMyTags);

  const {
    buildInviteMessage, buildFetchBeforeMessage, buildFetchAfterMessage,
    buildPublishMessage, buildAddTagToMessage, buildRemoveTagToMessage, buildDeleteMessage,
  } = useWebSocketMessageBuilder({ type: channelType, channelId: currentRoomId });

  const sendInvite = useCallback(
    (userIds: string[], roomId?: string) => {
      if (!userIds || userIds.length === 0) return;
      if (userIds.length === 1) {
        send(buildInviteMessage({ inviteUserId: userIds[0], channelIdOverride: roomId }));
      } else {
        send(buildInviteMessage({ inviteUserIdArray: userIds, channelIdOverride: roomId }));
      }
    },
    [buildInviteMessage, send],
  );

  const sendNewRoomInviteIfNeeded = useCallback(
    (roomId: string) => {
      const { invitedUserIds, otherUserIsExit } = useChatRoomInfo.getState();
      if (invitedUserIds.length > 0 && !otherUserIsExit) {
        sendInvite(invitedUserIds, roomId);
        useChatRoomInfo.setState({ invitedUserIds: [] });
        setTimeout(() => {
          queryClient.prefetchQuery(getSidePanelParticipantsQuery(roomId, channelType)).catch(() => {});
        }, 500);
      }
    },
    [sendInvite, queryClient, channelType],
  );

  const { sendMediaMessage, sendDocumentMessage } = useChatMediaUpload(sendNewRoomInviteIfNeeded);

  const sendTextMessage = useCallback(
    (content: string, tagList: string[] = []) => {
      if (!content.trim() || !currentRoomId) return;

      if (tagList.length > 0) {
        setNextMyTags(
          tagList.map(tagId => ({
            tagId: Number(tagId), categoryId: 0, categoryCode: '', categoryTitle: '',
            categoryDescription: '', code: '', title: '', description: '',
          })),
        );
      }

      sendNewRoomInviteIfNeeded(currentRoomId);
      send(buildPublishMessage({
        type: WS_MESSAGE_CONTENT_TYPE.TEXT, content, tagList, channelIdOverride: currentRoomId,
      }));

      const { otherUserIsExit, invitedUserIds } = useChatRoomInfo.getState();
      if (otherUserIsExit && invitedUserIds.length > 0) {
        sendInvite(invitedUserIds, currentRoomId);
        useChatRoomInfo.setState({ otherUserIsExit: false });
      }
    },
    [send, buildPublishMessage, currentRoomId, setNextMyTags, sendNewRoomInviteIfNeeded, sendInvite],
  );

  const loadMoreBeforeMessage = useCallback(
    (direction: ChatScrollDirection = 'before') => {
      const { messages, loading } = useChatRoomRuntimeStore.getState();
      if (messages.length === 0 || direction !== 'before') return;
      if (loading.isBeforeLoading || !loading.hasMoreBefore) return;
      setLoading({ isBeforeLoading: true });
      const firstId = messages[0]?.id;
      if (firstId) {
        send(buildFetchBeforeMessage({ currentMessage: firstId, isInclusive: false, channelIdOverride: currentRoomId ?? undefined }));
      }
    },
    [send, buildFetchBeforeMessage, currentRoomId, setLoading],
  );

  const loadMoreAfterMessage = useCallback(() => {
    const { messages, loading } = useChatRoomRuntimeStore.getState();
    if (messages.length === 0 || loading.isAfterLoading || !loading.hasMoreAfter) return;
    setLoading({ isAfterLoading: true });
    const lastId = messages[messages.length - 1]?.id;
    if (lastId) {
      send(buildFetchAfterMessage({ currentMessage: lastId, isInclusive: false, channelIdOverride: currentRoomId ?? undefined }));
    }
  }, [send, buildFetchAfterMessage, currentRoomId, setLoading]);

  const deleteMessage = useCallback(
    (messageId: string) => { send(buildDeleteMessage({ messageId })); },
    [send, buildDeleteMessage],
  );

  const addTagToMessage = useCallback(
    (params: UpdateTagToMessageProps) => { send(buildAddTagToMessage(params)); },
    [send, buildAddTagToMessage],
  );

  const removeTagFromMessage = useCallback(
    (params: RemoveTagMessageProps) => {
      useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(params.messageId);
      send(buildRemoveTagToMessage(params));
    },
    [send, buildRemoveTagToMessage],
  );

  return {
    sendTextMessage, loadMoreBeforeMessage, loadMoreAfterMessage,
    sendMediaMessage, sendDocumentMessage, deleteMessage, addTagToMessage, removeTagFromMessage,
  };
};

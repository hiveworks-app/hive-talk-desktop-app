"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSidePanelParticipantsQuery } from "@/features/chat-room-side-panel/queries";
import { apiDMCreate, apiGMCreate } from "@/features/create-chat-room/api";
import { useChatMediaUpload } from "@/features/chat-room/useChatMediaUpload";
import {
  WS_CHANNEL_TYPE,
  WS_MESSAGE_CONTENT_TYPE,
  RemoveTagMessageProps,
  UpdateTagToMessageProps,
} from "@/shared/types/websocket";
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from "@/shared/config/queryKeys";
import { formatKoreanTime } from "@/shared/utils/formatTimeUtils";
import { useAppWebSocket } from "@/shared/websocket/WebSocketContext";
import { useWebSocketMessageBuilder } from "@/shared/websocket/useWebSocketMessageBuilder";
import { useAuthStore } from "@/store/auth/authStore";
import { isOffline } from "@/shared/utils/offlineGuard";
import { useChatRoomRuntimeStore } from "@/store/chat/chatRoomRuntimeStore";
import { useChatRoomInfo } from "@/store/chat/chatRoomStore";

type ChatScrollDirection = "before" | "after";

const MESSAGE_SEND_TIMEOUT = 5_000;

export const useChatRoomActions = () => {
  const localTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const queryClient = useQueryClient();
  const { send, removePendingPublish } = useAppWebSocket();
  const { channelType } = useChatRoomInfo();
  const currentRoomId = useChatRoomRuntimeStore((s) => s.currentRoomId);
  const setLoading = useChatRoomRuntimeStore((s) => s.setLoading);
  const setNextMyTags = useChatRoomRuntimeStore((s) => s.setNextMyTags);
  const addLocalMessage = useChatRoomRuntimeStore((s) => s.addLocalMessage);

  const {
    buildSubscribeMessage,
    buildInviteMessage,
    buildFetchBeforeMessage,
    buildFetchAfterMessage,
    buildPublishMessage,
    buildAddTagToMessage,
    buildRemoveTagToMessage,
    buildDeleteMessage,
  } = useWebSocketMessageBuilder({
    type: channelType,
    channelId: currentRoomId,
  });

  const sendInvite = useCallback(
    (userIds: string[], roomId?: string) => {
      if (!userIds || userIds.length === 0) return;
      if (userIds.length === 1) {
        send(
          buildInviteMessage({
            inviteUserId: userIds[0],
            channelIdOverride: roomId,
          }),
        );
      } else {
        send(
          buildInviteMessage({
            inviteUserIdArray: userIds,
            channelIdOverride: roomId,
          }),
        );
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
          queryClient
            .prefetchQuery(getSidePanelParticipantsQuery(roomId, channelType))
            .catch(() => {});
        }, 500);
      }
    },
    [sendInvite, queryClient, channelType],
  );

  // 방이 아직 생성되지 않은 경우 (신규 DM/GM) 메시지 전송 직전에 방 생성
  const ensureRoomId = useCallback(async (): Promise<string | null> => {
    const runtimeRoomId = useChatRoomRuntimeStore.getState().currentRoomId;
    if (runtimeRoomId) return runtimeRoomId;

    const {
      invitedUserIds,
      channelType: ct,
      roomName,
    } = useChatRoomInfo.getState();
    if (!invitedUserIds || invitedUserIds.length === 0) return null;

    let newRoomId: string | null = null;

    try {
      if (ct === WS_CHANNEL_TYPE.DIRECT_MESSAGE) {
        const res = await apiDMCreate(invitedUserIds[0]);
        newRoomId = res.payload.roomId;
      } else if (ct === WS_CHANNEL_TYPE.GROUP_MESSAGE) {
        const myUserId = useAuthStore.getState().user?.id;
        const res = await apiGMCreate({
          title: roomName ?? "",
          userIdList: invitedUserIds.filter((id) => id !== String(myUserId)),
        });
        newRoomId = res.payload.roomId;
      }
    } catch (err) {
      console.error("[ensureRoomId] 방 생성 실패:", err);
      return null;
    }

    if (!newRoomId) return null;

    // 상태 업데이트
    useChatRoomInfo.getState().setChatRoomInfo({ roomId: newRoomId });
    useChatRoomRuntimeStore.getState().setRoomId(newRoomId);

    // WebSocket 구독 + 초대
    send(buildSubscribeMessage({ channelIdOverride: newRoomId }));
    sendInvite(invitedUserIds, newRoomId);
    useChatRoomInfo.setState({ invitedUserIds: [] });

    // React Query 캐시 갱신
    const targetKey =
      ct === WS_CHANNEL_TYPE.DIRECT_MESSAGE
        ? DM_ROOM_LIST_KEY
        : GM_ROOM_LIST_KEY;
    queryClient.invalidateQueries({ queryKey: targetKey });

    return newRoomId;
  }, [send, buildSubscribeMessage, sendInvite, queryClient]);

  const { sendMediaMessage, sendDocumentMessage } = useChatMediaUpload(
    sendNewRoomInviteIfNeeded,
    ensureRoomId,
  );

  const doSend = useCallback(
    (roomId: string, content: string, tagList: string[]) => {
      sendNewRoomInviteIfNeeded(roomId);
      send(
        buildPublishMessage({
          type: WS_MESSAGE_CONTENT_TYPE.TEXT,
          content,
          tagList,
          channelIdOverride: roomId,
        }),
      );

      const { otherUserIsExit, invitedUserIds } = useChatRoomInfo.getState();
      if (otherUserIsExit && invitedUserIds.length > 0) {
        sendInvite(invitedUserIds, roomId);
        useChatRoomInfo.setState({ otherUserIsExit: false });
      }
    },
    [send, buildPublishMessage, sendNewRoomInviteIfNeeded, sendInvite],
  );

  const addOptimisticTextMessage = useCallback(
    (content: string, tagList: string[], roomId: string) => {
      const localId = `local-text-${Date.now()}`;
      const loginUser = useAuthStore.getState().user;
      const createdAt = new Date().toISOString();
      addLocalMessage({
        id: localId,
        isLocal: true,
        localStatus: "uploading",
        messageContentType: WS_MESSAGE_CONTENT_TYPE.TEXT,
        text: content,
        time: formatKoreanTime(createdAt),
        createdAt,
        sender: "me",
        readUserIds: loginUser?.id ? [String(loginUser.id)] : [],
        notReadCount: 0,
        name: loginUser?.name ?? "",
        tags: [],
        files: [],
        retryPayload: { content, tagList, roomId },
      });
      return localId;
    },
    [addLocalMessage],
  );

  const startSendTimer = useCallback(
    (localId: string) => {
      const timer = setTimeout(() => {
        const msg = useChatRoomRuntimeStore
          .getState()
          .messages.find((m) => m.id === localId);
        if (msg?.isLocal) {
          if (msg.retryPayload?.content) {
            removePendingPublish(msg.retryPayload.content);
          }
          useChatRoomRuntimeStore
            .getState()
            .patchMessageById(localId, { localStatus: "failed" });
        }
        localTimersRef.current.delete(localId);
      }, MESSAGE_SEND_TIMEOUT);
      localTimersRef.current.set(localId, timer);
    },
    [removePendingPublish],
  );

  const sendTextMessage = useCallback(
    (content: string, tagList: string[] = []) => {
      if (!content.trim()) return;

      if (tagList.length > 0) {
        setNextMyTags(
          tagList.map((tagId) => ({
            tagId: Number(tagId),
            categoryId: 0,
            categoryCode: "",
            categoryTitle: "",
            categoryDescription: "",
            code: "",
            title: "",
            description: "",
          })),
        );
      } else {
        setNextMyTags(null);
      }

      // 기존 방: 동기적으로 즉시 전송
      const runtimeRoomId = useChatRoomRuntimeStore.getState().currentRoomId;

      // 모든 메시지: optimistic 로컬 메시지 즉시 표시
      const localId = addOptimisticTextMessage(
        content,
        tagList,
        runtimeRoomId ?? "",
      );

      if (runtimeRoomId) {
        doSend(runtimeRoomId, content, tagList);
        startSendTimer(localId);
        return;
      }

      // 신규 방: 방 생성 후 전송
      ensureRoomId().then((roomId) => {
        if (roomId) {
          // retryPayload에 실제 roomId 반영
          useChatRoomRuntimeStore.getState().patchMessageById(localId, {
            retryPayload: { content, tagList, roomId },
          });
          doSend(roomId, content, tagList);
          startSendTimer(localId);
        } else {
          useChatRoomRuntimeStore.setState((state) => ({
            messages: state.messages.filter((m) => m.id !== localId),
          }));
        }
      });
    },
    [
      setNextMyTags,
      addOptimisticTextMessage,
      doSend,
      ensureRoomId,
      startSendTimer,
    ],
  );

  const retryTextMessage = useCallback(
    (messageId: string) => {
      const msg = useChatRoomRuntimeStore
        .getState()
        .messages.find((m) => m.id === messageId);
      if (!msg?.retryPayload || !msg.isLocal) return;

      const { content, tagList, roomId } = msg.retryPayload;
      const effectiveRoomId =
        roomId || useChatRoomRuntimeStore.getState().currentRoomId;
      if (!effectiveRoomId) return;

      // 이전 전송이 pending queue에 남아있을 수 있으므로 먼저 제거 (중복 방지)
      removePendingPublish(content);
      useChatRoomRuntimeStore
        .getState()
        .patchMessageById(messageId, { localStatus: "uploading" });
      doSend(effectiveRoomId, content, tagList);
      startSendTimer(messageId);
    },
    [doSend, startSendTimer, removePendingPublish],
  );

  const removeFailedMessage = useCallback(
    (messageId: string) => {
      const msg = useChatRoomRuntimeStore
        .getState()
        .messages.find((m) => m.id === messageId);
      if (msg?.retryPayload?.content) {
        removePendingPublish(msg.retryPayload.content);
      }
      useChatRoomRuntimeStore.getState().removeMessageById(messageId);
      const timer = localTimersRef.current.get(messageId);
      if (timer) {
        clearTimeout(timer);
        localTimersRef.current.delete(messageId);
      }
    },
    [removePendingPublish],
  );

  const loadMoreBeforeMessage = useCallback(
    (direction: ChatScrollDirection = "before") => {
      const { messages, loading } = useChatRoomRuntimeStore.getState();
      if (messages.length === 0 || direction !== "before") return;
      if (loading.isBeforeLoading || !loading.hasMoreBefore) return;
      setLoading({ isBeforeLoading: true });
      const firstId = messages[0]?.id;
      if (firstId) {
        send(
          buildFetchBeforeMessage({
            currentMessage: firstId,
            isInclusive: false,
            channelIdOverride: currentRoomId ?? undefined,
          }),
        );
      }
    },
    [send, buildFetchBeforeMessage, currentRoomId, setLoading],
  );

  const loadMoreAfterMessage = useCallback(() => {
    const { messages, loading } = useChatRoomRuntimeStore.getState();
    if (
      messages.length === 0 ||
      loading.isAfterLoading ||
      !loading.hasMoreAfter
    )
      return;
    setLoading({ isAfterLoading: true });
    const lastId = messages[messages.length - 1]?.id;
    if (lastId) {
      send(
        buildFetchAfterMessage({
          currentMessage: lastId,
          isInclusive: false,
          channelIdOverride: currentRoomId ?? undefined,
        }),
      );
    }
  }, [send, buildFetchAfterMessage, currentRoomId, setLoading]);

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (isOffline()) return;
      send(buildDeleteMessage({ messageId }));
    },
    [send, buildDeleteMessage],
  );

  const addTagToMessage = useCallback(
    (params: UpdateTagToMessageProps) => {
      if (isOffline()) return;
      send(buildAddTagToMessage(params));
    },
    [send, buildAddTagToMessage],
  );

  const removeTagFromMessage = useCallback(
    (params: RemoveTagMessageProps) => {
      if (isOffline()) return;
      useChatRoomRuntimeStore
        .getState()
        .setPendingRemoveTagMessageId(params.messageId);
      send(buildRemoveTagToMessage(params));
    },
    [send, buildRemoveTagToMessage],
  );

  return {
    sendTextMessage,
    loadMoreBeforeMessage,
    loadMoreAfterMessage,
    sendMediaMessage,
    sendDocumentMessage,
    deleteMessage,
    addTagToMessage,
    removeTagFromMessage,
    retryTextMessage,
    removeFailedMessage,
  };
};

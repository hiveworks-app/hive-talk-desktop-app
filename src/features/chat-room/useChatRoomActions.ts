"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSidePanelParticipantsQuery } from "@/features/chat-room-side-panel/queries";
import { apiDMCreate, apiGMCreate } from "@/features/create-chat-room/api";
import { apiEMCreate } from "@/features/external-chat/api";
import { discardMediaRetryFiles, useChatMediaUpload } from "@/features/chat-room/useChatMediaUpload";
import {
  WS_CHANNEL_TYPE,
  WS_MESSAGE_CONTENT_TYPE,
  RemoveTagMessageProps,
  UpdateTagToMessageProps,
} from "@/shared/types/websocket";
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from "@/shared/config/queryKeys";
import { formatKoreanTime } from "@/shared/utils/formatTimeUtils";
import { useAppWebSocket } from "@/shared/websocket/WebSocketContext";
import { useWebSocketMessageBuilder } from "@/shared/websocket/useWebSocketMessageBuilder";
import { useAuthStore } from "@/store/auth/authStore";
import { isOffline } from "@/shared/utils/offlineGuard";
import { useChatRoomRuntimeStore } from "@/store/chat/chatRoomRuntimeStore";
import { useChatRoomInfo } from "@/store/chat/chatRoomStore";
import { useFailedMessagesStore } from "@/store/chat/failedMessagesStore";
import { useUIStore } from "@/store/uiStore";
import { useLeaveRoom } from "@/features/chat-room-list/useLeaveRoom";
import { markDraftBackfill } from "@/features/chat-room/draftBackfill";

type ChatScrollDirection = "before" | "after";

const MESSAGE_SEND_TIMEOUT = 5_000;

export const useChatRoomActions = () => {
  const localTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const queryClient = useQueryClient();
  const { send, removePendingPublish } = useAppWebSocket();
  // 빈 방 정리용(실패 메시지 삭제 → 확정 메시지 0건이면 방 EXIT)
  const { leaveRoom } = useLeaveRoom();
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

    // RN 패리티 — draft 방 생성 동안 로딩 오버레이
    useUIStore.getState().showLoadingOverlay({ message: '채팅방을 만들고 있어요' });
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
      } else if (ct === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE) {
        // EM draft — 첫 메시지 전송 시 생성 (취소 시 빈 방 잔존 방지, RN 패리티).
        // 자기 자신 포함 시 서버 ERM005 — /app/gm과 동일하게 제외.
        const myUserId = useAuthStore.getState().user?.id;
        const res = await apiEMCreate({
          title: roomName ?? "",
          userIdList: invitedUserIds.filter((id) => id !== String(myUserId)),
        });
        newRoomId = res.payload.roomId;
      }
    } catch (err) {
      console.error("[ensureRoomId] 방 생성 실패:", err);
      return null;
    } finally {
      useUIStore.getState().hideLoadingOverlay();
    }

    if (!newRoomId) return null;
    // 서버가 roomId를 숫자로 내려줘도 WS 에코 필터(p.message.roomId === currentRoomId, strict ===)가
    // 어긋나지 않게 문자열로 정규화 — 어긋나면 에코가 조용히 버려져 5초 타임아웃 실패가 된다
    newRoomId = String(newRoomId);

    // 상태 업데이트
    useChatRoomInfo.getState().setChatRoomInfo({ roomId: newRoomId });
    useChatRoomRuntimeStore.getState().setRoomId(newRoomId);

    // 생성 트랜잭션의 시스템 메시지(초대 공지)는 SUB 전 발행 — 첫 PUB 수신 시 1회 BEFORE 회수 (RN 패리티)
    markDraftBackfill(newRoomId);

    // WebSocket 구독 + 초대 (EM은 서버가 초대 시스템 메시지를 자동 발행 — 클라이언트 invite 스킵, RN FR-26)
    send(buildSubscribeMessage({ channelIdOverride: newRoomId }));
    if (ct !== WS_CHANNEL_TYPE.EXTERNAL_MESSAGE) {
      sendInvite(invitedUserIds, newRoomId);
    }
    useChatRoomInfo.setState({ invitedUserIds: [] });

    // React Query 캐시 갱신
    const targetKey =
      ct === WS_CHANNEL_TYPE.DIRECT_MESSAGE ? DM_ROOM_LIST_KEY
        : ct === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? EM_ROOM_LIST_KEY
        : GM_ROOM_LIST_KEY;
    queryClient.invalidateQueries({ queryKey: targetKey });

    return newRoomId;
  }, [send, buildSubscribeMessage, sendInvite, queryClient]);

  const { sendMediaMessage, sendDocumentMessage, retryMediaMessage } = useChatMediaUpload(
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

      // 자동초대는 상대가 "자발적으로 나간" 경우만 — 회원탈퇴/소속해제(otherUserIsRemoved)면 불가 (정책 dm.md)
      const { otherUserIsExit, otherUserIsRemoved, invitedUserIds } = useChatRoomInfo.getState();
      if (otherUserIsExit && !otherUserIsRemoved && invitedUserIds.length > 0) {
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
        const { messages, currentRoomId, patchMessageById } = useChatRoomRuntimeStore.getState();
        const msg = messages.find((m) => m.id === localId);
        if (msg?.isLocal) {
          if (msg.retryPayload?.content) {
            removePendingPublish(msg.retryPayload.content);
          }
          // 에코 미스 진단 — 발생 시 방/메시지 식별자로 원인 추적 (RN reportEchoMiss 대응)
          console.warn('[SEND] 5초 내 서버 에코 없음 → 실패 처리:', {
            localId,
            roomId: msg.retryPayload?.roomId || currentRoomId,
          });
          patchMessageById(localId, { localStatus: "failed" });
          // 실패 메시지 영속화 — 방 이탈/재실행 후 복원 + 목록 느낌표 판정 소스 (RN 패리티)
          const failedRoomId = msg.retryPayload?.roomId || currentRoomId;
          if (failedRoomId) {
            useFailedMessagesStore.getState().saveFailed(failedRoomId, { ...msg, localStatus: 'failed' });
          }
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
      // DM 상대 회원탈퇴/소속해제 — 전송 불가 (입력바 비활성의 이중 방어, 정책 dm.md)
      if (useChatRoomInfo.getState().otherUserIsRemoved) return;

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
      // 미디어/파일 실패는 보관된 원본 File로 재업로드 (RN retryPayload/retryFilePayload 대응)
      if (retryMediaMessage(messageId)) return;
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
      // 재시도 시작 — 영속 실패 목록에서 제거 (다시 실패하면 타이머가 재저장)
      useFailedMessagesStore.getState().removeFailed(effectiveRoomId, messageId);

      // 재시도: 현재 시간으로 갱신 + 메시지를 맨 아래로 이동
      const now = new Date().toISOString();
      useChatRoomRuntimeStore.setState((state) => ({
        messages: [
          ...state.messages.filter((m) => m.id !== messageId),
          {
            ...msg,
            localStatus: "uploading" as const,
            createdAt: now,
            time: formatKoreanTime(now),
            retryPayload: { content, tagList, roomId: effectiveRoomId },
          },
        ],
      }));
      doSend(effectiveRoomId, content, tagList);
      startSendTimer(messageId);
    },
    [doSend, startSendTimer, removePendingPublish, retryMediaMessage],
  );

  const removeFailedMessage = useCallback(
    (messageId: string) => {
      const msg = useChatRoomRuntimeStore
        .getState()
        .messages.find((m) => m.id === messageId);
      if (msg?.retryPayload?.content) {
        removePendingPublish(msg.retryPayload.content);
      }
      // 미디어/파일 실패 삭제 시 재전송용 원본 정리
      discardMediaRetryFiles(msg?.fileId);
      useChatRoomRuntimeStore.getState().removeMessageById(messageId);
      // 영속 실패 목록에서도 제거 (목록 느낌표 해제)
      const failedRoomId = msg?.retryPayload?.roomId || useChatRoomRuntimeStore.getState().currentRoomId;
      if (failedRoomId) useFailedMessagesStore.getState().removeFailed(failedRoomId, messageId);
      const timer = localTimersRef.current.get(messageId);
      if (timer) {
        clearTimeout(timer);
        localTimersRef.current.delete(messageId);
      }

      // 첫 메시지 실패 삭제로 방이 "빈 방"(서버 확정 일반 메시지 0건 + 남은 실패 0건)이 되면
      // 방 자체를 정리 — 방 생성 성공 후 전송만 실패한 경우 서버에 빈 방이 잔존하는 것 방지 (2026-08-20 결정).
      const state = useChatRoomRuntimeStore.getState();
      const roomId = state.currentRoomId;
      if (roomId) {
        const SYSTEM_TYPES = new Set<string>([
          WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE,
          WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT,
          WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE,
          WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE,
          WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE,
          WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED,
        ]);
        const hasConfirmed = state.messages.some(
          (m) => !m.isLocal && !SYSTEM_TYPES.has(m.messageContentType),
        );
        const remainingFailed =
          useFailedMessagesStore.getState().byRoom[roomId]?.length ?? 0;
        if (!hasConfirmed && remainingFailed === 0) {
          const ct = useChatRoomInfo.getState().channelType;
          leaveRoom(roomId, ct, { silent: true });
          useUIStore.getState().showSnackbar({ message: '메시지가 없는 채팅방이 정리되었어요.', state: 'info' });
        }
      }
    },
    [removePendingPublish, leaveRoom],
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

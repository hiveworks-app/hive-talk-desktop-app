'use client';

import { useCallback, useRef, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { consumeDraftBackfill } from '@/features/chat-room/draftBackfill';
import { mergeTagsPreservingOrder } from '@/features/chat-room/mergeTagsPreservingOrder';
import { optimisticTagRemoveGuard } from '@/features/chat-room/optimisticTagRemoveGuard';
import { pendingTagRemoveRegistry } from '@/features/chat-room/pendingTagRemoveRegistry';
import { pendingTagUpdateRegistry } from '@/features/chat-room/pendingTagUpdateRegistry';
import { closeIfPopup } from '@/shared/utils/popupWindow';
import { ParticipantsManager } from '@/features/chat-room/domain';
import { useChatRoomWsFetchHandlers } from '@/features/chat-room/useChatRoomWsFetchHandlers';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { TagListType } from '@/shared/types/tag';
import {
  Message, WS_CHANNEL_TYPE, WS_MESSAGE_CONTENT_TYPE, WebSocketChannelTypes, WebSocketEnvelope,
  WebSocketMessageType,
  WebSocketPublishItem, isAddTagBroadcast, isAddTagSession, isBroadcast, isDeleteMessage,
  isExitMessageRoomBroadcast, isExitMessageRoomSession, isFetchAfterMessage, isFetchBeforeMessage,
  isFetchMessage, isMediaFileMessage, isPublish, isReadMessage, isRemoveTagBroadcast,
  isRemoveTagSession, isReportedMessageBroadcast, isReportHiddenBroadcast,
  isRoomChannelSessionFailure, isSub, isSubscribeSession, isViewInMessage, isViewOutMessage,
} from '@/shared/types/websocket';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

interface UseChatRoomWsHandlersParams {
  channelType: WebSocketChannelTypes;
  parseWsMessage: ReturnType<typeof createWsMessageParser>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  replaceMessages: (next: Message[]) => void;
  setLoading: (loading: Record<string, unknown>) => void;
  deleteMessageById: (id: string) => void;
  replaceLocalWithServer: (fileId: string, serverMessage: Message) => void;
  normalizeUserId: (userId: string | number | null | undefined) => string;
  participantsManager: ParticipantsManager;
  recalculateAllMessagesNotReadCount: (participants: ParticipantItemsType[]) => void;
  isReconnectFetchRef: MutableRefObject<boolean>;
  isInitialFetchRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
  /** draft 백필용 — 첫 PUB 수신 시 FETCH_BEFORE 1회 발행 */
  send: (msg: unknown) => void;
  buildFetchBeforeMessage: (opts: { currentMessage: string; isInclusive: boolean; channelIdOverride: string }) => unknown;
  /** 유령 구독 방지 재전송용 (RN CHANNEL_RETRY 패리티) */
  buildSubscribeMessage: (opts: { channelIdOverride: string }) => unknown;
  buildViewInMessageRoom: (opts: { channelIdOverride: string }) => unknown;
  buildFetchAfterMessage: (opts: { currentMessage: string; isInclusive: boolean; channelIdOverride: string }) => unknown;
  viewStateRef: MutableRefObject<'in' | 'out' | null>;
}

/* 🔁 SUB/VIEW_IN 실패(SE003 등) 재전송 정책 — 유령 구독 방지 (RN 2026-07-20 dev 장애 실측 패리티) */
const CHANNEL_RETRY_MAX = 3;
const CHANNEL_RETRY_BASE_DELAY_MS = 1500; // 1.5s → 3s → 6s 지수 백오프

export const useChatRoomWsHandlers = (params: UseChatRoomWsHandlersParams) => {
  const {
    channelType, parseWsMessage, setMessages, deleteMessageById,
    replaceLocalWithServer, participantsManager, recalculateAllMessagesNotReadCount, isMountedRef,
    send, buildFetchBeforeMessage,
    buildSubscribeMessage, buildViewInMessageRoom, buildFetchAfterMessage, viewStateRef,
  } = params;
  const queryClient = useQueryClient();
  const router = useAppRouter();

  const { handleFetchBeforeHistory, handleFetchAfterHistory, handleReadMessage } =
    useChatRoomWsFetchHandlers(params);

  const handleExitMessageRoom = useCallback((roomId: string) => {
    const roomListKey = channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ? GM_ROOM_LIST_KEY : DM_ROOM_LIST_KEY;
    queryClient.setQueryData<GetChatRoomListItemType[]>(roomListKey, oldData =>
      oldData ? oldData.filter(item => item.roomModel.roomId !== roomId) : [],
    );
    // 다른 창/기기에서 이 방을 나가면 팝업에도 같은 브로드캐스트가 온다 —
    // 팝업은 목록으로 가지 않고 창을 닫는다
    if (closeIfPopup()) return;
    router.push('/chat');
  }, [channelType, queryClient, router]);

  const handleTagBroadcast = useCallback((targetMessageId: string, items: TagListType[]) => {
    const normalized = items.map(item => ({ ...item, tagId: Number(item.tagId), categoryId: Number(item.categoryId) }));
    const seen = new Set<number>();
    const dedup = normalized.filter(item => { if (seen.has(item.tagId)) return false; seen.add(item.tagId); return true; });
    // 서버 응답 순서를 그대로 쓰면 기존 태그 위치가 흔들린다 — 기존 순서 유지 병합 (RN 패리티)
    setMessages(prev =>
      prev.map(m =>
        m.id === targetMessageId ? { ...m, tags: mergeTagsPreservingOrder(m.tags, dedup) } : m,
      ),
    );
    // 미확정(-1) 창에서 예약된 태그 해제가 있으면, 확정된 실제 taggingId로 지금 발사
    pendingTagRemoveRegistry.consumeOnTagBroadcast(targetMessageId, dedup);
  }, [setMessages]);

  // 신고 마스킹: REPORTED → 마스킹 텍스트(TEXT) / REPORT_HIDDEN → 시스템 안내(SYSTEM_REPORTED)
  const maskReportedMessage = useCallback(
    (messageId: string, content: string, contentType: WebSocketMessageType) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, text: content, messageContentType: contentType, files: [], tags: [] } : m,
        ),
      );
    },
    [setMessages],
  );

  const handleParticipantChange = useCallback((eventType: 'EXIT' | 'INVITE', roomId: string) => {
    participantsManager.refetchParticipants(roomId, channelType).then(() => {
      if (!isMountedRef.current) return;
      const participants = participantsManager.getParticipants(roomId, channelType);
      useChatRoomInfo.getState().setChatRoomInfo({ totalUserCount: participants.length });
      recalculateAllMessagesNotReadCount(participants);
    }).catch(error => { console.error(`[WS] SUBMIT_${eventType} refetch 실패:`, error); });
  }, [participantsManager, channelType, recalculateAllMessagesNotReadCount, isMountedRef]);

  const handlePublishMessage = useCallback((payload: WebSocketPublishItem, roomId: string) => {
    // draft 생성 직후 첫 PUB — 생성 트랜잭션과 함께 발행된 시스템 메시지(초대 공지)는
    // SUB 전이라 broadcast로 못 받는다 → 이 메시지를 앵커로 1회 BEFORE 회수 (RN 패리티)
    if (consumeDraftBackfill(roomId) && payload.message?.id) {
      send(buildFetchBeforeMessage({
        currentMessage: payload.message.id,
        isInclusive: false,
        channelIdOverride: roomId,
      }));
    }

    const m = parseWsMessage({ item: payload });
    if (!m) return;

    const incomingFileId = isMediaFileMessage(payload.message)
      ? (payload.message.payload.fileId ?? undefined) : undefined;
    if (incomingFileId) {
      const { messages } = useChatRoomRuntimeStore.getState();
      if (messages.some(msg => msg.fileId === incomingFileId && msg.isLocal)) {
        replaceLocalWithServer(incomingFileId, m);
        return;
      }
    }

    // Optimistic 텍스트 메시지: 로컬 메시지를 서버 메시지로 교체 (가장 오래된 것부터)
    if (m.sender === 'me' && !incomingFileId) {
      const { messages } = useChatRoomRuntimeStore.getState();
      const localTextId = messages.find(msg => msg.isLocal && msg.localStatus !== 'failed' && msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT)?.id;
      if (localTextId) {
        useChatRoomRuntimeStore.setState(state => ({
          messages: state.messages.map(msg =>
            msg.id === localTextId ? { ...m, isLocal: false } : msg,
          ),
        }));
        return;
      }
    }

    setMessages(prev => (prev.some(msg => msg.id === m.id) ? prev : [...prev, m]));

    if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT) {
      handleParticipantChange('EXIT', roomId);
    } else if (payload.message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE) {
      handleParticipantChange('INVITE', roomId);
    }
  }, [parseWsMessage, replaceLocalWithServer, setMessages, handleParticipantChange, send, buildFetchBeforeMessage]);

  /* 🔁 SUB/VIEW_IN 실패 백오프 재전송 (RN scheduleRoomChannelRetry 패리티).
     거절을 방치하면 방 화면은 정상처럼 보여도 서버에 구독이 없어 READ/PUB 브로드캐스트가
     전부 유실된다("유령 구독"). 실패가 연달아 와도 타이머 1개로 SUB+VIEW_IN을 함께 복구한다. */
  const channelRetryRef = useRef<{ roomId: string | null; count: number; timer: ReturnType<typeof setTimeout> | null }>({ roomId: null, count: 0, timer: null });
  const scheduleChannelRetry = useCallback((operationType: string, code?: string) => {
    // 예산은 방 단위 — 이전 방이 소진한 카운트가 다음 방의 재시도를 막으면 유령 구독이 된다 (2026-08-26 리뷰)
    const scheduledRoomId = useChatRoomRuntimeStore.getState().currentRoomId;
    if (channelRetryRef.current.roomId !== scheduledRoomId) {
      if (channelRetryRef.current.timer) clearTimeout(channelRetryRef.current.timer);
      channelRetryRef.current = { roomId: scheduledRoomId, count: 0, timer: null };
    }
    const retry = channelRetryRef.current;
    if (retry.timer) return;
    if (retry.count >= CHANNEL_RETRY_MAX) {
      console.warn(`[WS][CHANNEL-RETRY] ${operationType} 재전송 한도(${CHANNEL_RETRY_MAX}회) 초과 — 재연결 전까지 브로드캐스트 유실 가능`);
      return;
    }
    const delay = CHANNEL_RETRY_BASE_DELAY_MS * Math.pow(2, retry.count);
    console.warn(`[WS][CHANNEL-RETRY] ${operationType} 실패(code=${code ?? '?'}) → ${delay}ms 후 SUB/VIEW_IN 재전송 (${retry.count + 1}/${CHANNEL_RETRY_MAX})`);
    retry.timer = setTimeout(() => {
      retry.timer = null;
      retry.count += 1;
      const activeRoomId = useChatRoomRuntimeStore.getState().currentRoomId;
      // 방이 바뀌었으면 이전 방의 재전송 폐기 (예산도 새 방 첫 실패 시 리셋됨)
      if (!isMountedRef.current || !activeRoomId || activeRoomId !== scheduledRoomId) return;
      send(buildSubscribeMessage({ channelIdOverride: activeRoomId }));
      // 블러 상태에선 VIEW_IN을 보내지 않는다 — 보지 않는 사용자가 '보는 중'으로 기록되면
      // 상대에게 안읽음이 표시되지 않는다 (RN AppState 가드의 데스크톱 대응 = viewState 래치)
      if (viewStateRef.current === 'in') {
        send(buildViewInMessageRoom({ channelIdOverride: activeRoomId }));
      }
    }, delay);
  }, [send, buildSubscribeMessage, buildViewInMessageRoom, viewStateRef, isMountedRef]);

  const extractTagTarget = (payload: { items: TagListType[] } & Record<string, unknown>) =>
    payload.items[0]?.messageId ?? (payload.messageId as string | undefined);

  const handleWsMessage = useCallback((data: WebSocketEnvelope) => {
    const roomId = useChatRoomRuntimeStore.getState().currentRoomId;
    if (!roomId) return;

    // SUB/VIEW_IN 실패(SE003 등) → 유령 구독 방지 백오프 재전송 (RN 패리티)
    if (isRoomChannelSessionFailure(data)) {
      scheduleChannelRetry(String(data.response.operationType), data.response.code);
      return;
    }
    // SUB 성공 ack — 재시도 복구였다면 실패~복구 사이 유실된 READ/PUB을 fetch로 만회 (RN 패리티)
    if (isSubscribeSession(data)) {
      const retry = channelRetryRef.current;
      if (retry.count > 0 && data.response.success !== false) {
        retry.count = 0;
        const anchorId = [...useChatRoomRuntimeStore.getState().messages].reverse().find(m => !m.isLocal)?.id;
        console.info('[WS][CHANNEL-RETRY] SUB 복구 성공 → 유실 구간 catch-up');
        if (anchorId) {
          // AFTER: 유실된 신규 메시지 회수 / BEFORE(inclusive): 기존 메시지의 읽음·삭제 최신화
          send(buildFetchAfterMessage({ currentMessage: anchorId, isInclusive: false, channelIdOverride: roomId }));
          send(buildFetchBeforeMessage({ currentMessage: anchorId, isInclusive: true, channelIdOverride: roomId }));
        }
      }
      return;
    }

    if (isViewInMessage(data) || isViewOutMessage(data)) return;
    if (isExitMessageRoomSession(data)) {
      // 다른 방 EXIT의 ack가 허브→스포크 relay로 들어와 현재 방(팝업)을 닫지 않도록 payload 방 확인.
      // 서버가 payload 없이(null) 응답하는 경우만 현재 방의 EXIT으로 간주 (RN 1729-1738 패리티)
      const exitedRoomId = (data.response.payload as { roomId?: string } | null)?.roomId;
      if (exitedRoomId == null || String(exitedRoomId) === String(roomId)) {
        handleExitMessageRoom(roomId);
      }
      return;
    }
    if (isFetchMessage(data) || isFetchBeforeMessage(data)) { handleFetchBeforeHistory(data.response.payload, roomId); return; }
    if (isFetchAfterMessage(data)) { handleFetchAfterHistory(data.response.payload, roomId); return; }
    if (isAddTagSession(data) || isRemoveTagSession(data)) return;
    if (!isBroadcast(data)) return;

    // 신고 마스킹(REPORTED/REPORT_HIDDEN) — REPORTED엔 response.channelType이 없어 채널 필터보다 먼저 처리
    if (isReportedMessageBroadcast(data)) {
      const p = data.response.payload;
      if (p.roomId === roomId && p.messageId) maskReportedMessage(p.messageId, p.content, WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK);
      return;
    }
    if (isReportHiddenBroadcast(data)) {
      const p = data.response.payload;
      if (p.roomId === roomId && p.messageId) maskReportedMessage(p.messageId, p.content, WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED);
      return;
    }

    if (data.response.channelType !== channelType) return;
    if (isSub(data)) return;

    if (isDeleteMessage(data)) { deleteMessageById(data.response.payload.message.id); return; }
    if (isReadMessage(data)) { handleReadMessage(data.response.payload?.items ?? [], roomId); return; }
    if (isPublish(data)) {
      const p = data.response.payload;
      // RN useChatRoomController 패리티: 비정상 envelope(message 누락) 방어
      if (p?.message?.roomId === roomId) {
        handlePublishMessage(p, roomId);
      } else if (p?.message?.roomId != null) {
        // 에코가 여기서 조용히 버려지면 5초 타임아웃 실패가 된다 — 타입 불일치 추적용
        console.warn('[WS] PUB 무시 — roomId 불일치:', p.message.roomId, '(현재:', roomId, ')');
      }
      return;
    }
    if (isExitMessageRoomBroadcast(data)) {
      const loginUserId = String(useAuthStore.getState().user?.id ?? '');
      if (String(data.response.payload?.userId) === loginUserId) handleExitMessageRoom(roomId);
    }
    if (isAddTagBroadcast(data)) {
      const p = data.response.payload;
      const target = extractTagTarget(p);
      if (target) handleTagBroadcast(target, p.items);
      return;
    }
    if (isRemoveTagBroadcast(data)) {
      const p = data.response.payload;
      const pendingId = useChatRoomRuntimeStore.getState().pendingRemoveTagMessageId;
      const target = extractTagTarget(p) ?? pendingId;
      // 낙관적 해제 성공 신호 — 실패 복구 타이머 해제
      if (target) optimisticTagRemoveGuard.disarm(target);
      // REMOVE→ADD 콤보 진행 중 — 중간 상태(유지분만 남음)는 화면에 반영하지 않고
      // 대기 중이던 ADD를 발사한다 (TA003 회피, RN pendingTagUpdateRegistry 패리티)
      if (target && pendingTagUpdateRegistry.consumeOnRemoveBroadcast(target)) {
        useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
        return;
      }
      if (target) handleTagBroadcast(target, p.items);
      useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
    }
  }, [
    handleExitMessageRoom, handleFetchBeforeHistory, handleFetchAfterHistory,
    handleTagBroadcast, deleteMessageById, handleReadMessage, handlePublishMessage, channelType,
    maskReportedMessage, scheduleChannelRetry, send, buildFetchAfterMessage, buildFetchBeforeMessage,
  ]);

  return { handleWsMessage };
};

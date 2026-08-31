import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { updateChatRoomListWithDeletion } from '@/features/chat-room-list/updater';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY, ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import type { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import type {
  WebSocketEnvelope,
  WebSocketChannelTypes,
  WebSocketSingleMessagePayload,
} from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import type { MessageHandlerDeps } from './types';
import { getTargetQueryKey } from './types';

/** 초대받은 경우 자동 구독 */
export function handleRoomInvite(
  envelope: WebSocketEnvelope,
  globalChannelType: WebSocketChannelTypes | undefined,
  deps: MessageHandlerDeps,
) {
  const channelId = envelope.response.payload as string;
  const channelIdOverride = { channelIdOverride: channelId };
  const channelTypeOverride = globalChannelType && {
    channelTypeOverride: globalChannelType,
  };
  const subMsg = deps.buildSubscribeMessage({
    ...channelIdOverride,
    ...channelTypeOverride,
  });
  deps.sendRef.current(subMsg);
}

/** 메시지 삭제 */
export function handleDeleteMessage(
  envelope: WebSocketEnvelope,
  globalChannelType: WebSocketChannelTypes | undefined,
  deps: MessageHandlerDeps,
) {
  const pubPayload = envelope.response.payload as WebSocketSingleMessagePayload;
  const roomId = pubPayload.message.roomId;
  const messageId = pubPayload.message.id;
  if (!messageId) return;

  const listener = deps.listenersRef.current[roomId];
  if (listener) listener(envelope);

  const currentChannelType = globalChannelType || (envelope.response as { channelType?: WebSocketChannelTypes }).channelType;
  const targetQueryKey = getTargetQueryKey(currentChannelType);
  if (targetQueryKey) {
    deps.queryClient.setQueryData<GetChatRoomListItemType[]>(targetQueryKey, prev =>
      updateChatRoomListWithDeletion(prev, roomId, messageId),
    );
  }
}

/** ADD_TAG 브로드캐스트 */
export function handleAddTag(envelope: WebSocketEnvelope, deps: MessageHandlerDeps) {
  Object.values(deps.listenersRef.current).forEach(listener => listener(envelope));
}

/** REMOVE_TAG 브로드캐스트 */
export function handleRemoveTag(envelope: WebSocketEnvelope, deps: MessageHandlerDeps) {
  useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(null);
  Object.values(deps.listenersRef.current).forEach(listener => listener(envelope));
}

/** 방 나감 브로드캐스트 */
export function handleExitRoom(envelope: WebSocketEnvelope, deps: MessageHandlerDeps) {
  const { loginUserId, queryClient, listenersRef } = deps;
  if (!loginUserId) return;

  const { userId, roomId } = envelope.response.payload as { userId: string; roomId: string };

  if (userId !== loginUserId) {
    queryClient.setQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY, prev => {
      if (!prev) return [];
      return prev.map(room => {
        if (room.roomModel.roomId !== roomId) return room;
        const updatedParticipantDetail = room.roomModel.participantDetail
          ? String(room.roomModel.participantDetail.userId) === userId
            ? { ...room.roomModel.participantDetail, isExit: true }
            : room.roomModel.participantDetail
          : undefined;
        return {
          ...room,
          roomModel: { ...room.roomModel, participantDetail: updatedParticipantDetail },
        };
      });
    });

    // GM/EM: 목록 캐시 participants에서 나간 사람 제거 — "혼자 남음" dimmed UI(목록·사이드패널)가
    // 재조회 없이 즉시 반영되도록 (RN WebSocketContext EXIT_ROOM 분기 패리티, Figma 1769:57917)
    const exitChannelType = (envelope.response as { channelType?: WebSocketChannelTypes }).channelType;
    if (
      exitChannelType === WS_CHANNEL_TYPE.GROUP_MESSAGE ||
      exitChannelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
    ) {
      const groupKey = getTargetQueryKey(exitChannelType);
      if (groupKey) {
        queryClient.setQueryData<GetChatRoomListItemType[]>(groupKey, prev => {
          if (!prev) return prev;
          return prev.map(room => {
            if (room.roomModel.roomId !== roomId) return room;
            const nextParticipants = (room.roomModel.participants ?? []).filter(
              p => String(p.userId) !== String(userId),
            );
            return { ...room, roomModel: { ...room.roomModel, participants: nextParticipants } };
          });
        });
      }
      // 사이드패널 participants 쿼리도 동기화 — 방 안에서 패널을 보고 있을 때 즉시 반영
      queryClient.setQueryData<ParticipantItemsType[]>(
        ROOM_PARTICIPANTS_KEY(roomId, exitChannelType),
        prev => (prev ? prev.filter(p => String(p.userId) !== String(userId)) : prev),
      );
    }

    const currentChatRoomId = useChatRoomInfo.getState().roomId;
    if (currentChatRoomId === roomId) {
      useChatRoomInfo.setState({ otherUserIsExit: true, invitedUserIds: [userId] });
    }
  } else {
    // 본인이 나간 경우 — 목록에서 제거한다.
    //
    // 지금까지는 방 안에 등록된 리스너(useChatRoomWsHandlers.handleExitMessageRoom)가 이걸 처리했다.
    // 단일 창에서는 나가기가 항상 "목록에서" 아니면 "그 방 안에서" 일어나 리스너가 늘 살아 있었지만,
    // 멀티 채팅창이 생기면서 "팝업에서 나갔는데 메인 창은 그 방을 안 보고 있는" 조합이 가능해졌다.
    // 그 경우 메인 창엔 리스너가 없어 나간 방이 목록에 남는다 — 전역에서도 지운다 (중복 제거는 무해).
    const channelType = (envelope.response as { channelType?: WebSocketChannelTypes }).channelType;
    const targetKey = getTargetQueryKey(channelType);
    // channelType이 없으면 어느 목록인지 모르므로 셋 다 훑는다 (없는 목록에선 no-op)
    const keys = targetKey ? [targetKey] : [DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY];
    keys.forEach(key => {
      queryClient.setQueryData<GetChatRoomListItemType[]>(key, prev =>
        // prev가 없으면(이 창에서 아직 목록을 안 받음) undefined 반환 → 캐시 미변경.
        // []를 쓰면 목록을 "0건"으로 덮어써 빈 화면이 뜬다.
        prev ? prev.filter(room => room.roomModel.roomId !== roomId) : prev,
      );
    });
  }

  // 기타 리스너에게 전달
  Object.values(listenersRef.current).forEach(listener => listener(envelope));
}

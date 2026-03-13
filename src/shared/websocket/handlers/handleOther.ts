import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { updateChatRoomListWithDeletion } from '@/features/chat-room-list/updater';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
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

    const currentChatRoomId = useChatRoomInfo.getState().roomId;
    if (currentChatRoomId === roomId) {
      useChatRoomInfo.setState({ otherUserIsExit: true, invitedUserIds: [userId] });
    }
  }

  // 기타 리스너에게 전달
  Object.values(listenersRef.current).forEach(listener => listener(envelope));
}

import type { WebSocketEnvelope, WebSocketChannelTypes } from '@/shared/types/websocket';
import {
  isBroadcast,
  isRoomInvite,
  isReadMessage,
  isPublish,
  isDeleteMessage,
  isAddTagBroadcast,
  isRemoveTagBroadcast,
  isExitMessageRoomBroadcast,
  parseSocketResponseType,
} from '@/shared/types/websocket';
import type { MessageHandlerDeps } from './types';
import { handleReadMessage } from './handleReadMessage';
import { handlePublish } from './handlePublish';
import {
  handleRoomInvite,
  handleDeleteMessage,
  handleAddTag,
  handleRemoveTag,
  handleExitRoom,
} from './handleOther';

export function routeMessage(rawData: string, deps: MessageHandlerDeps) {
  let envelope: WebSocketEnvelope;

  try {
    envelope = JSON.parse(rawData) as WebSocketEnvelope;
  } catch {
    Object.values(deps.listenersRef.current).forEach(listener =>
      listener(rawData as unknown as WebSocketEnvelope),
    );
    return;
  }

  let globalChannelType: WebSocketChannelTypes | undefined;

  if (isBroadcast(envelope)) {
    const { channelType } = envelope.response;
    globalChannelType =
      channelType ||
      (parseSocketResponseType(envelope.socketResponseType)?.channelType as WebSocketChannelTypes | undefined);
  }

  if (isRoomInvite(envelope)) {
    handleRoomInvite(envelope, globalChannelType, deps);
    return;
  }

  if (isReadMessage(envelope)) {
    handleReadMessage(envelope, globalChannelType, deps);
    return;
  }

  if (isPublish(envelope)) {
    handlePublish(envelope, globalChannelType, deps);
    return;
  }

  if (isDeleteMessage(envelope)) {
    handleDeleteMessage(envelope, globalChannelType, deps);
    return;
  }

  if (isAddTagBroadcast(envelope)) {
    handleAddTag(envelope, deps);
    return;
  }

  if (isRemoveTagBroadcast(envelope)) {
    handleRemoveTag(envelope, deps);
    return;
  }

  if (isExitMessageRoomBroadcast(envelope)) {
    handleExitRoom(envelope, deps);
    return;
  }

  // 기타 메시지
  Object.values(deps.listenersRef.current).forEach(listener => listener(envelope));
}

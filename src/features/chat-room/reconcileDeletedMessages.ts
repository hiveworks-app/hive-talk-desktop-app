import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { Message, WebSocketPublishItem } from '@/shared/types/websocket';

export function extractDeletedMessageIds(serverItems: WebSocketPublishItem[]): Set<string> {
  const deletedIds = new Set<string>();
  for (const item of serverItems) {
    if (item.message.isDeleted) {
      deletedIds.add(item.message.id);
    }
  }
  return deletedIds;
}

export function applyReconciliation(messages: Message[], serverDeletedIds: Set<string>): Message[] {
  if (serverDeletedIds.size === 0) return messages;

  let hasChanges = false;
  const result = messages.map(msg => {
    if (!serverDeletedIds.has(msg.id)) return msg;
    if (msg.isDeleted) return msg;

    hasChanges = true;
    return {
      ...msg,
      isDeleted: true,
      messageContentType: 'TEXT' as const,
      text: IS_DELETE_MESSAGE_COMMENTS,
      files: [],
    };
  });

  return hasChanges ? result : messages;
}

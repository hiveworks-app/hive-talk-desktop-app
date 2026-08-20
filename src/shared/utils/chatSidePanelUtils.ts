import { WebSocketPublishItem } from '@/shared/types/websocket';
import { UNKNOWN_USER_NAME } from '@/shared/config/constants';
import { MediaListType } from '@/shared/types/media';

export const convertedMediaList = (cachedAttachments: WebSocketPublishItem[]): MediaListType[] => {
  return cachedAttachments.flatMap(item => {
    const { message, sender } = item;

    if (
      message.messageContentType !== 'IMAGE' &&
      message.messageContentType !== 'MEDIA' &&
      message.messageContentType !== 'FILE'
    ) {
      return [];
    }

    const messageItem = message.payload?.items ?? [];

    return messageItem.map(media => ({
      id: media.path,
      messageId: message.id,
      createdAt: message.createdAt,
      messageContentType: message.messageContentType,
      thumbnailPath: media.meta.thumbnail,
      thumbnailPresignedUrl: media.meta.thumbnailPresignedUrl,
      presignedUrl: media.presignedUrl,
      path: media.path,
      author: sender?.isDeleted === true ? UNKNOWN_USER_NAME : sender?.name || '작성자',
      senderId: sender?.userId != null ? String(sender.userId) : undefined,
      fileSize: media.meta.size,
      duration: media.meta.duration,
    }));
  });
};

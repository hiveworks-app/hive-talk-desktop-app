import { WebSocketPublishItem } from '@/shared/types/websocket';
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
      author: sender?.name || '작성자',
      fileSize: media.meta.size,
    }));
  });
};

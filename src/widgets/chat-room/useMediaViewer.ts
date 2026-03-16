'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import type { ChatMessageUI } from '@/shared/types/websocket';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

export function useMediaViewer(messages: ChatMessageUI[]) {
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const allMediaItems = useMemo(() => {
    const items: MediaViewerItem[] = [];
    for (const msg of messages) {
      if (msg.isDeleted || msg.isLocal) continue;
      if (
        msg.messageContentType !== WS_MESSAGE_CONTENT_TYPE.IMAGE &&
        msg.messageContentType !== WS_MESSAGE_CONTENT_TYPE.MEDIA
      ) continue;
      for (const file of msg.files ?? []) {
        items.push({
          id: file.path || msg.id,
          type: file.meta?.type?.startsWith('video/') ? 'video' : 'image',
          url: file.presignedUrl || file.path,
          storageKey: file.path,
          author: msg.name,
        });
      }
    }
    return items;
  }, [messages]);

  const openMediaViewer = useCallback(
    (items: MediaViewerItem[], startIndex: number) => {
      const clickedItem = items[startIndex];
      if (!clickedItem) return;
      const globalIndex = allMediaItems.findIndex(m => m.id === clickedItem.id);
      setViewerIndex(globalIndex >= 0 ? globalIndex : 0);
      setViewerVisible(true);
    },
    [allMediaItems],
  );

  const closeMediaViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  return {
    viewerIndex,
    setViewerIndex,
    viewerVisible,
    allMediaItems,
    openMediaViewer,
    closeMediaViewer,
  };
}

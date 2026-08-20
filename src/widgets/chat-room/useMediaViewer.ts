'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSidePanelBeforeAttachmentQuery } from '@/features/chat-room-side-panel/queries';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import type { MediaListType } from '@/shared/types/media';
import type { ChatMessageUI, WebSocketChannelTypes } from '@/shared/types/websocket';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

interface MediaViewerRoomOptions {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

/** 정렬·중복제거용 내부 엔트리 — 뷰어에 넘길 때는 MediaViewerItem 부분만 사용 */
type ViewerEntry = MediaViewerItem & { createdAtMs: number };

/** 사이드패널 첨부 응답 1건 → 뷰어 엔트리 (MEDIA=동영상 판별은 useSidePanelMediaViewer와 동일) */
function attachmentToEntry(media: MediaListType): ViewerEntry {
  return {
    id: media.id,
    type: media.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ? 'video' : 'image',
    url: media.presignedUrl || media.path,
    storageKey: media.path,
    author: media.author,
    createdAt: media.createdAt,
    senderId: media.senderId,
    poster: media.thumbnailPresignedUrl,
    createdAtMs: Date.parse(media.createdAt) || 0,
  };
}

/**
 * 채팅방 미디어 뷰어 — 로드된 메시지의 첨부 + 방 전체 첨부 히스토리(사이드패널 쿼리)를 병합해
 * 과거 첨부까지 끊김 없이 탐색한다 (RN ChatRoomMediaScreen 패리티).
 *
 * - 현재 위치는 index가 아닌 storageKey로 앵커 — 과거 페이지가 prepend되어도 보던 항목이 유지된다.
 * - 뷰어가 목록 앞(과거) 근처에 도달하면 다음 페이지를 자동 로드한다.
 */
export function useMediaViewer(messages: ChatMessageUI[], room?: MediaViewerRoomOptions) {
  const [viewerVisible, setViewerVisible] = useState(false);
  // 현재 보고 있는 항목의 storageKey — 소스(메시지/첨부쿼리)가 달라도 같은 파일을 가리킨다
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  const messageEntries = useMemo(() => {
    const items: ViewerEntry[] = [];
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
          createdAt: msg.createdAt,
          senderId: msg.senderId,
          poster: file.meta?.thumbnailPresignedUrl,
          createdAtMs: Date.parse(msg.createdAt) || 0,
        });
      }
    }
    return items;
  }, [messages]);

  // 방 전체 첨부 히스토리 — 뷰어가 열려 있을 때만 조회 (사이드패널과 캐시 공유)
  const attachmentQuery = useInfiniteQuery({
    ...getSidePanelBeforeAttachmentQuery(
      room?.roomId ?? '',
      room?.lastMessageId ?? '',
      room?.channelType,
    ),
    enabled: viewerVisible && !!room?.roomId && !!room?.lastMessageId,
  });

  const allMediaItems = useMemo<MediaViewerItem[]>(() => {
    const attachmentEntries = (attachmentQuery.data?.pages.flatMap(p => p.items) ?? []).map(attachmentToEntry);
    // storageKey 기준 병합 — 첨부 쿼리 응답이 정본(작성자·썸네일 포함), 메시지 파생분은 보충
    const byKey = new Map<string, ViewerEntry>();
    for (const entry of messageEntries) {
      byKey.set(entry.storageKey ?? entry.id, entry);
    }
    for (const entry of attachmentEntries) {
      byKey.set(entry.storageKey ?? entry.id, entry);
    }
    return [...byKey.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
  }, [messageEntries, attachmentQuery.data]);

  const viewerIndex = useMemo(() => {
    if (!currentKey) return 0;
    const idx = allMediaItems.findIndex(item => (item.storageKey ?? item.id) === currentKey);
    return idx >= 0 ? idx : 0;
  }, [allMediaItems, currentKey]);

  // 목록 앞(과거) 근처 도달 시 다음 페이지 자동 로드 — 과거 첨부로 계속 넘길 수 있게
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = attachmentQuery;
  useEffect(() => {
    if (!viewerVisible) return;
    if (viewerIndex <= 2 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [viewerVisible, viewerIndex, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setViewerIndex = useCallback(
    (index: number) => {
      const item = allMediaItems[index];
      if (item) setCurrentKey(item.storageKey ?? item.id);
    },
    [allMediaItems],
  );

  const openMediaViewer = useCallback(
    (items: MediaViewerItem[], startIndex: number) => {
      const clickedItem = items[startIndex];
      if (!clickedItem) return;
      setCurrentKey(clickedItem.storageKey ?? clickedItem.id);
      setViewerVisible(true);
    },
    [],
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

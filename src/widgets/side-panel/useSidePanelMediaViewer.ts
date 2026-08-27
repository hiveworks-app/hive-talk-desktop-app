'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import type { MediaListType } from '@/shared/types/media';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

/**
 * 사이드패널 "사진/동영상" 그리드에서 항목을 누르면 채팅방과 동일한
 * 전체화면 `MediaViewer` 팝업을 열기 위한 상태/변환 훅.
 *
 * - `displayed`: 현재 화면에 보이는(검색 필터 적용 후) 미디어 목록.
 *   뷰어의 prev/next 가 "사용자가 보는 그대로"의 순서를 따르도록
 *   필터링된 목록을 그대로 받는다.
 */
export function useSidePanelMediaViewer(displayed: MediaListType[]) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const items = useMemo<MediaViewerItem[]>(
    () => displayed.map(toViewerItem),
    [displayed],
  );

  const open = useCallback((startIndex: number) => {
    setIndex(startIndex);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return { items, index, setIndex, visible, open, close };
}

/**
 * 사이드패널 미디어 1건(`MediaListType`)을 전체화면 뷰어 항목(`MediaViewerItem`)으로 변환.
 *
 * 결정 포인트:
 * - 비디오/이미지 판별: 사이드패널 응답에는 `meta.type`(예: "video/mp4")이 없고
 *   `messageContentType`('IMAGE' | 'MEDIA')만 있다. 모바일(SidePanelMediaThumb)과
 *   동일하게 `MEDIA` 를 동영상으로 본다.
 * - url/storageKey: `path`(NCP 스토리지 키)를 storageKey 로 넘기면 뷰어가
 *   presigned URL 만료 시 자동 재발급한다. url 은 첫 렌더용 fallback.
 */
function toViewerItem(media: MediaListType): MediaViewerItem {
  return {
    id: media.id,
    type: media.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ? 'video' : 'image',
    url: media.presignedUrl || media.path,
    storageKey: media.path,
    author: media.author,
    createdAt: media.createdAt,
    senderId: media.senderId,
    poster: media.thumbnailPresignedUrl,
    bundleId: media.messageId,
  };
}

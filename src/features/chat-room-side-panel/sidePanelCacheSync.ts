import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { ROOM_BEFORE_ATTACHMENT_KEY, ROOM_BEFORE_FILE_KEY } from '@/shared/config/queryKeys';
import {
  WS_MESSAGE_CONTENT_TYPE,
  type WebSocketChannelTypes,
  type WebSocketPublishItem,
} from '@/shared/types/websocket';
import { convertedMediaList } from '@/shared/utils/chatSidePanelUtils';
import type { FilesPage } from './queries';

/**
 * 사이드패널 첨부/파일 캐시에 PUB echo 메시지를 prepend. (RN sidePanelCacheSync 패리티)
 *
 * 전역 PUB 핸들러(handlePublish)에서 호출한다 — 방 컨트롤러(방 안에서만 마운트)가 아닌
 * 전역에서 처리해야, 업로드 완료 전에 방을 나간 경우에도 echo 도착 즉시 캐시에 반영된다.
 * 미이식 시 방금 보낸/받은 사진·파일이 staleTime 30분 동안 사이드패널 미리보기·탭에
 * 나타나지 않는다 (2026-08-26 감사).
 *
 * 캐시 미존재 시에는 시드하지 않고 no-op — 첫 패널 오픈이 서버에서 전체 목록을 받아온다.
 * (RN 실측: placeholder 시드는 이전 사진 페이지네이션까지 차단)
 */
export function prependSidePanelCache(
  queryClient: QueryClient,
  payload: WebSocketPublishItem,
  roomId: string,
  channelType: WebSocketChannelTypes,
): void {
  const contentType = payload.message.messageContentType;
  const isImageOrMedia =
    contentType === WS_MESSAGE_CONTENT_TYPE.IMAGE || contentType === WS_MESSAGE_CONTENT_TYPE.MEDIA;
  const isFile = contentType === WS_MESSAGE_CONTENT_TYPE.FILE;
  if (!isImageOrMedia && !isFile) return;

  const queryKey = isImageOrMedia
    ? ROOM_BEFORE_ATTACHMENT_KEY(roomId, channelType)
    : ROOM_BEFORE_FILE_KEY(roomId, channelType);

  queryClient.setQueryData<InfiniteData<FilesPage>>(queryKey, oldData => {
    // 캐시 미존재 → no-op (시드 금지, 상단 doc comment 참조)
    if (!oldData || oldData.pages.length === 0) return oldData;

    const newItems = convertedMediaList([payload]);
    if (newItems.length === 0) return oldData;

    // 이미 존재하면 no-op (대표 id로 dedup — 다중 미디어 메시지는 첫 항목만 검사해도 충분)
    const firstNewId = newItems[0].id;
    if (oldData.pages.flatMap(p => p.items).some(item => item.id === firstNewId)) {
      return oldData;
    }

    const addedSize = newItems.reduce((sum, m) => {
      const size = Number(m.fileSize ?? 0);
      return Number.isFinite(size) && size > 0 ? sum + size : sum;
    }, 0);

    // 첫 페이지에 prepend + totals 증분
    const firstPage = oldData.pages[0];
    const updatedFirstPage: FilesPage = {
      items: [...newItems, ...firstPage.items],
      pagination: {
        ...firstPage.pagination,
        totalItems: firstPage.pagination.totalItems + newItems.length,
      },
      totalFileSize: firstPage.totalFileSize + addedSize,
    };
    return { ...oldData, pages: [updatedFirstPage, ...oldData.pages.slice(1)] };
  });
}

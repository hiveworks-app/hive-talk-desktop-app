import { infiniteQueryOptions, keepPreviousData } from '@tanstack/react-query';
import {
  FILES_KEY,
  FILE_SENDERS_KEY,
  ROOM_BEFORE_ATTACHMENT_KEY,
  ROOM_BEFORE_FILE_KEY,
  ROOM_PARTICIPANTS_KEY,
} from '@/shared/config/queryKeys';
import { MediaListType } from '@/shared/types/media';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { convertedMediaList } from '@/shared/utils/chatSidePanelUtils';
import {
  apiGetFileSenders,
  apiGetFiles,
  apiGetSidePanelParticipants,
  channelTypeToRoomType,
} from './api';
import { FileSenderContentType } from './type';

// ────────────────────────────────────────────────
// 단일 코어: GET /app/chat/files 호출 + page-based 페이징 정의 (RN 패리티).
// base/filter 모드 모두 이 코어를 spread해서 사용. cache 정책(staleTime 등)은
// 각 wrapper가 override하므로 모드별 UX 정책은 보존됨.
// 각 페이지는 { items, pagination, totalFileSize } 구조 — 서버가 dataset 전체 totals를 매 페이지마다 반환.
// ────────────────────────────────────────────────
const FILES_PAGE_SIZE = 30;

export type FilesPage = {
  items: MediaListType[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
  totalFileSize: number;
};

type RoomFilesQueryCoreProps = {
  roomId: string;
  channelType: WebSocketChannelTypes;
  contentType: FileSenderContentType[];
  senders?: string[];
  fileName?: string;
};

const buildRoomFilesQueryCore = ({
  roomId,
  channelType,
  contentType,
  senders,
  fileName,
}: RoomFilesQueryCoreProps) => ({
  queryFn: async ({ pageParam }: { pageParam: number }): Promise<FilesPage> => {
    const res = await apiGetFiles({
      roomType: channelTypeToRoomType(channelType),
      roomId,
      contentType,
      senders: senders ?? [],
      fileName: fileName?.trim() || undefined,
      page: pageParam,
      size: FILES_PAGE_SIZE,
    });
    return {
      items: convertedMediaList(res.payload.items ?? []),
      pagination: res.payload.pagination,
      totalFileSize: res.payload.totalFileSize,
    };
  },
  // page-based: pagination.currentPage < totalPages면 다음 페이지 존재.
  getNextPageParam: (lastPage: FilesPage): number | undefined => {
    const { currentPage, totalPages } = lastPage.pagination;
    if (!Number.isFinite(currentPage) || !Number.isFinite(totalPages)) return undefined;
    return currentPage < totalPages ? currentPage + 1 : undefined;
  },
});

// ────────────────────────────────────────────────
// Base 모드: 사이드패널 진입 시 사진/동영상 (방별, 필터 없음)
// 두 번째 인자는 backward-compat 위해 시그니처만 유지(무시됨) — 구 lastMessageId 커서.
// ────────────────────────────────────────────────
export const getSidePanelBeforeAttachmentQuery = (
  roomId: string,
  _legacy: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) =>
  infiniteQueryOptions({
    ...buildRoomFilesQueryCore({
      roomId,
      channelType,
      contentType: ['IMAGE', 'MEDIA'],
    }),
    queryKey: ROOM_BEFORE_ATTACHMENT_KEY(roomId, channelType),
    initialPageParam: 1,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

// ────────────────────────────────────────────────
// Base 모드: 사이드패널 진입 시 파일 (방별, 필터 없음)
// ────────────────────────────────────────────────
export const getSidePanelBeforeFileQuery = (
  roomId: string,
  _legacy: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) =>
  infiniteQueryOptions({
    ...buildRoomFilesQueryCore({
      roomId,
      channelType,
      contentType: ['FILE'],
    }),
    queryKey: ROOM_BEFORE_FILE_KEY(roomId, channelType),
    initialPageParam: 1,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

/**
 * GET /app/chat/files/senders 무한 스크롤 쿼리 (RN 패리티).
 * 현재 방에서 contentType의 파일을 보낸 유저를 이름 부분일치로 검색.
 * - 사진/동영상 검색: contentType=['IMAGE', 'MEDIA'] / 파일 검색: contentType=['FILE']
 */
const FILE_SENDERS_PAGE_SIZE = 50;

export const getFileSendersInfiniteQuery = ({
  roomId,
  channelType,
  contentType,
  keyword = '',
  from = '',
  to = '',
}: {
  roomId: string;
  channelType: WebSocketChannelTypes;
  contentType: FileSenderContentType[];
  keyword?: string;
  from?: string;
  to?: string;
}) =>
  infiniteQueryOptions({
    queryKey: FILE_SENDERS_KEY(roomId, channelType, contentType, keyword, from, to),
    initialPageParam: undefined as { lastName: string; lastUserId: string } | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await apiGetFileSenders({
        roomType: channelTypeToRoomType(channelType),
        roomId,
        contentType,
        keyword: keyword.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        lastName: pageParam?.lastName,
        lastUserId: pageParam?.lastUserId,
        count: FILE_SENDERS_PAGE_SIZE,
      });
      return res.payload;
    },
    // 다음 페이지 커서: 응답의 마지막 유저 name/userId. 페이지 크기 미만이면 끝.
    getNextPageParam: lastPage => {
      if (!lastPage.items.length || lastPage.items.length < FILE_SENDERS_PAGE_SIZE) {
        return undefined;
      }
      const last = lastPage.items[lastPage.items.length - 1];
      return { lastName: last.name, lastUserId: String(last.userId) };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    // 키워드 변경 시 새 결과 도착 전까지 이전 결과 유지 → 빈 화면 플리커 방지
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

/**
 * Filter 모드: 보낸사람/파일명 필터로 파일 메시지를 최신순 조회 (RN 패리티).
 */
export const getFilesInfiniteQuery = ({
  roomId,
  channelType,
  contentType,
  senders,
  fileName = '',
}: {
  roomId: string;
  channelType: WebSocketChannelTypes;
  contentType: FileSenderContentType[];
  senders: string[];
  fileName?: string;
}) =>
  infiniteQueryOptions({
    ...buildRoomFilesQueryCore({
      roomId,
      channelType,
      contentType,
      senders,
      fileName,
    }),
    queryKey: FILES_KEY(channelType, roomId, contentType, senders, fileName),
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    // 파일명 키워드 타이핑 시에만 이전 결과 유지 (스무스 UX).
    // 보낸사람/탭(contentType) 변경 시에는 placeholder를 버리고 즉시 로딩 상태로 전환.
    placeholderData: (prevData, prevQuery) => {
      if (!prevData || !prevQuery) return undefined;
      const prevKey = prevQuery.queryKey as readonly unknown[];
      // FILES_KEY 구조: [channelType, 'files', roomId, contentType, senders, fileName]
      const sameRoom = prevKey[0] === channelType && prevKey[2] === roomId;
      const sameContentType = prevKey[3] === contentType.join(',');
      const sameSenders = prevKey[4] === [...senders].sort().join(',');
      if (sameRoom && sameContentType && sameSenders) return prevData;
      return undefined;
    },
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const getSidePanelParticipantsQuery = (
  roomId: string,
  channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE,
) => ({
  queryKey: ROOM_PARTICIPANTS_KEY(roomId, channelType),
  queryFn: async () => {
    const res = await apiGetSidePanelParticipants(roomId, channelType);
    return res.payload.items;
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: 1,
});

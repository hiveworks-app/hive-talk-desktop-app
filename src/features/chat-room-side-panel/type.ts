import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { Pagination } from '@/shared/types/pagination';
import { WebSocketChannelTypes, WebSocketPublishItem } from '@/shared/types/websocket';

export interface GetSidePanelAttachmentsProps {
  roomId: string;
  lastMessageId: string;
  messageContentType: string[];
  channelType?: WebSocketChannelTypes;
}

export interface GetSidePanelAttachmentsResponse {
  items: WebSocketPublishItem[];
}

export interface GetSidePanelParticipantsResponse {
  items: ParticipantItemsType[];
  pagination: Pagination;
}

// ────────────────────────────────────────────────
// GET /app/chat/files + /app/chat/files/senders — 서버 필터 (RN 패리티)
// ────────────────────────────────────────────────

// 콘텐츠 타입 — IMAGE, MEDIA, FILE 복수 선택
export type FileSenderContentType = 'IMAGE' | 'MEDIA' | 'FILE';

// 채널/방 타입 (API는 'DM' / 'GM' / 'EM'으로 받음)
export type FileSenderRoomType = 'DM' | 'GM' | 'EM';

// GET /app/chat/files/senders 요청 파라미터
export interface GetFileSendersParams {
  keyword?: string;
  contentType?: FileSenderContentType[];
  roomType?: FileSenderRoomType;
  roomId?: string;
  // YYYY-MM-DD (KST 기준)
  from?: string;
  to?: string;
  // 커서 (이전 페이지 마지막 유저)
  lastName?: string;
  lastUserId?: string;
  // 페이지 크기 (기본 50, 최대 100)
  count?: number;
}

// 응답 단일 발신자 항목 — GET /app/chat/files/senders 실제 응답 기준
export interface FileSenderItem {
  userId: string;
  name: string;
  email?: string;
  profileUrl?: string | null;
  profilePresignedUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  thumbnailProfilePresignedUrl?: string | null;
  isExternal?: boolean;
}

// 응답 — cursor 기반 페이지네이션 (다음 페이지는 마지막 유저 name/userId를 커서로 재호출)
export interface GetFileSendersResponse {
  items: FileSenderItem[];
}

// GET /app/chat/files — 보낸사람/파일명/기간 필터로 파일 메시지 조회
export interface GetFilesParams {
  contentType?: FileSenderContentType[];
  roomType?: FileSenderRoomType;
  roomId?: string;
  // userId 목록 (최대 50명)
  senders?: string[];
  // 파일명 부분일치 검색
  fileName?: string;
  // KST yyyy-MM-dd
  from?: string;
  to?: string;
  // 페이지 (1-base)
  page?: number;
  // 페이지 크기 (기본 50, 최대 100)
  size?: number;
}

export interface GetFilesResponse {
  items: WebSocketPublishItem[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
  totalFileSize: number;
}

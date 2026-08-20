import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';

/** 사내채팅 목록 필터 칩 (목록 사이드바·검색 화면 공용) */
export const COMPANY_CHAT_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'dm', label: '1:1 채팅' },
  { key: 'gm', label: '그룹채팅' },
] as const;

export type ChatChip = (typeof COMPANY_CHAT_CHIPS)[number]['key'];

export type TaggedRoom = {
  room: GetChatRoomListItemType;
  channelType: WebSocketChannelTypes;
};

/** 최신 메시지 시각(ms). sortAt 우선 — 차단 발신자 메시지 수신 시 freeze된 정렬 시각 (상단 이동 금지, RN 패리티) */
export const lastActivityMs = (room: GetChatRoomListItemType) =>
  Date.parse(
    room.sortAt ?? room.messageList[0]?.message.createdAt ?? room.roomModel.createdAt ?? '',
  ) || 0;

/** 검색 대상 텍스트: 채팅방 이름 + 상대방 이름 (정책 chat.md). */
export const roomSearchText = (room: GetChatRoomListItemType) => {
  const { title, participantDetail, participants } = room.roomModel;
  return [
    title,
    participantDetail?.name,
    ...(participants?.map(p => p.name) ?? []),
  ]
    .filter(Boolean)
    .join(' ');
};

export const NO_PIN_RANK = Number.POSITIVE_INFINITY;

/**
 * 방의 "관심멤버 rank"(작을수록 위) — 멤버목록 등록 순서 기준.
 * DM=상대방 rank, GM=참여자 중 최소 rank, 관심멤버 없으면 Infinity. (RN sortRooms 패리티, 정책 chat.md:38)
 */
export const roomFavoriteRank = (
  { room, channelType }: TaggedRoom,
  rankMap: Map<string, number>,
): number => {
  if (channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE) {
    const userId = room.roomModel.participantDetail?.userId;
    return userId ? rankMap.get(userId) ?? NO_PIN_RANK : NO_PIN_RANK;
  }
  let min = NO_PIN_RANK;
  for (const p of room.roomModel.participants ?? []) {
    const rank = rankMap.get(p.userId);
    if (rank !== undefined && rank < min) min = rank;
  }
  return min;
};

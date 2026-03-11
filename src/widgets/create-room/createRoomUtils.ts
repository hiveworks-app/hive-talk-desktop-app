import type { QueryClient } from '@tanstack/react-query';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';

export function findExistingDMRoom(
  queryClient: QueryClient,
  targetUserId: string,
): GetChatRoomListItemType | undefined {
  const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
  return dmRooms.find(room => {
    const uid = String(targetUserId);
    if (String(room.roomModel.participantDetail?.userId) === uid) return true;
    return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
  });
}

export function extractRoomIdFromError(err: { payload?: unknown; rawBody?: string }): string | null {
  // 1. err.payload.payload.roomId (ApiResponse 구조)
  const body = err.payload as Record<string, unknown> | null;
  if (body?.payload && typeof body.payload === 'object') {
    const inner = body.payload as Record<string, unknown>;
    if (typeof inner.roomId === 'string') return inner.roomId;
  }

  // 2. err.payload.roomId (flat 구조)
  if (body && typeof body.roomId === 'string') return body.roomId;

  // 3. rawBody에서 roomId JSON 파싱 시도
  if (err.rawBody) {
    try {
      const parsed = JSON.parse(err.rawBody);
      const roomId = parsed?.payload?.roomId ?? parsed?.roomId;
      if (typeof roomId === 'string') return roomId;
    } catch { /* ignore */ }
  }

  return null;
}

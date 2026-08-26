import { QueryClient } from '@tanstack/react-query';
import { getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { readCountCalculator } from './readCountCalculator';

export class ParticipantsManager {
  private queryClient: QueryClient;
  private participantIdsCache = new Map<string, { data: Set<string>; timestamp: number }>();
  private static CACHE_TTL_MS = 1000;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  private getCacheKey(roomId: string, channelType: WebSocketChannelTypes): string {
    return `${channelType}:${roomId}`;
  }

  getParticipants(roomId: string, channelType: WebSocketChannelTypes): ParticipantItemsType[] {
    const data = this.queryClient.getQueryData<ParticipantItemsType[]>(
      ROOM_PARTICIPANTS_KEY(roomId, channelType),
    );
    return data ?? [];
  }

  getParticipantIds(roomId: string, channelType: WebSocketChannelTypes): Set<string> {
    const cacheKey = this.getCacheKey(roomId, channelType);
    const cached = this.participantIdsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ParticipantsManager.CACHE_TTL_MS) {
      return cached.data;
    }

    const participants = this.getParticipants(roomId, channelType);
    const participantIds = readCountCalculator.createParticipantIdSet(participants);

    this.participantIdsCache.set(cacheKey, {
      data: participantIds,
      timestamp: Date.now(),
    });

    return participantIds;
  }

  getParticipantCount(roomId: string, channelType: WebSocketChannelTypes): number {
    return this.getParticipants(roomId, channelType).length;
  }

  /**
   * 신뢰 가능한 참여자 스냅샷 (RN 진입 동기화 완전성 가드 패리티).
   * 초대 직후 서버 /participants가 잠시 본인만 반환하는 구간(RN 2026-07-29 실측)에 그 목록으로
   * 읽음 수를 계산하면 틀린 값이 화면에 굳는다. 기대 인원(expectedCount)에 못 미치는 목록은
   * 빈 배열로 취급해 호출부의 totalUserCount 폴백 계산을 태운다.
   */
  getReliableParticipants(
    roomId: string,
    channelType: WebSocketChannelTypes,
    expectedCount: number,
  ): ParticipantItemsType[] {
    const participants = this.getParticipants(roomId, channelType);
    if (expectedCount > 0 && participants.length < expectedCount) return [];
    return participants;
  }

  async refetchParticipants(roomId: string, channelType: WebSocketChannelTypes): Promise<void> {
    const cacheKey = this.getCacheKey(roomId, channelType);
    this.participantIdsCache.delete(cacheKey);

    await this.queryClient.refetchQueries({
      queryKey: ROOM_PARTICIPANTS_KEY(roomId, channelType),
    });
  }

  async ensureParticipants(
    roomId: string,
    channelType: WebSocketChannelTypes,
  ): Promise<ParticipantItemsType[]> {
    const cacheKey = this.getCacheKey(roomId, channelType);
    this.participantIdsCache.delete(cacheKey);

    const data = await this.queryClient.ensureQueryData(
      getSidePanelParticipantsQuery(roomId, channelType),
    );
    return data ?? [];
  }

  invalidateCache(roomId: string, channelType: WebSocketChannelTypes): void {
    const cacheKey = this.getCacheKey(roomId, channelType);
    this.participantIdsCache.delete(cacheKey);
  }

  clearAllCache(): void {
    this.participantIdsCache.clear();
  }
}

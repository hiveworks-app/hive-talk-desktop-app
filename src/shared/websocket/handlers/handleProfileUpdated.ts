import { MEMBERS_KEY, PRESIGNED_URL } from '@/shared/config/queryKeys';
import type { ParticipantItemsType } from '@/shared/types/chatRoom';
import type { ProfileUpdatedPayload, WebSocketBroadcastProps } from '@/shared/types/websocket';
import type { MessageHandlerDeps } from './types';

/**
 * 👤 프로필 변경 실시간 반영 (BROADCAST/PROFILE/UPDATED).
 * desktop은 LocalDB가 없어 React Query 캐시만 갱신한다:
 * - 사이드패널 참여자(모든 방): 이름/썸네일 외과적 갱신
 * - 멤버/조직/외부 목록: refetch 무효화 (캐시 shape 다양 → 무효화가 안전)
 * - presigned 이미지: 무효화로 새 아바타 로드 (같은 path 재업로드 대비)
 */
export function handleProfileUpdated(
  envelope: WebSocketBroadcastProps<ProfileUpdatedPayload>,
  deps: MessageHandlerDeps,
) {
  const p = envelope.response.payload;
  const userId = String(p.userId);
  const { queryClient } = deps;

  // 1) 사이드패널 참여자 캐시(모든 방, ROOM_PARTICIPANTS_KEY = [channelType,'participants',roomId])
  queryClient.setQueriesData<ParticipantItemsType[]>(
    { predicate: query => query.queryKey[1] === 'participants' },
    prev => {
      if (!prev) return prev;
      let changed = false;
      const next = prev.map(item => {
        if (String(item.userId) !== userId) return item;
        changed = true;
        return { ...item, name: p.name, thumbnailProfileUrl: p.thumbnailProfileUrl ?? null };
      });
      return changed ? next : prev;
    },
  );

  // 2) 멤버/조직/외부 멤버 목록 — refetch로 최신화 (prefix 무효화)
  queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
  queryClient.invalidateQueries({ queryKey: ['organizationMembers'] });
  queryClient.invalidateQueries({ queryKey: ['externalMembers'] });

  // 3) presigned 이미지 캐시 무효화 — 새 프로필 사진 로드
  if (p.profileUrl) queryClient.invalidateQueries({ queryKey: PRESIGNED_URL(p.profileUrl) });
  if (p.thumbnailProfileUrl && p.thumbnailProfileUrl !== p.profileUrl) {
    queryClient.invalidateQueries({ queryKey: PRESIGNED_URL(p.thumbnailProfileUrl) });
  }
}

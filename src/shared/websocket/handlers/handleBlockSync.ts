import { normalizeBlockedItem } from '@/features/block/normalize';
import { BLOCKED_MEMBERS_KEY, MEMBERS_KEY, PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import type { FetchUserRawModel } from '@/shared/types/websocket';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import type { MessageHandlerDeps } from './types';

/**
 * 🚫 차단 동기화 공통 적용 (RN WebSocketContext.applyBlockSync 패리티).
 * BROADCAST/USER/BLOCKED|UNBLOCKED(단건)와 INIT/USER/BLOCK_SYNC(오프라인 누적 델타)가 공용.
 * 1) 스토어 직접 반영 — 컴포넌트 마운트와 무관하게 hot path 판정 보장
 * 2) React Query 캐시 증분 갱신 — invalidate 금지 (eventual-consistency 깜빡임 방지)
 * 3) 해제분 있으면 멤버 목록 재조회 (목록 복원)
 * 4) 차단분 있으면 관심멤버 재조회 (서버가 자동 unpin)
 */
export function applyBlockSync(
  blockedRaw: FetchUserRawModel[],
  unblockedRaw: FetchUserRawModel[],
  deps: MessageHandlerDeps,
) {
  const { queryClient } = deps;

  const blocked = blockedRaw
    .map(normalizeBlockedItem)
    .filter((m): m is MemberItem => m !== null);
  const unblockedIds = unblockedRaw
    .map(raw => String(raw.userId ?? ''))
    .filter(id => id && id !== 'undefined' && id !== 'null');

  if (blocked.length === 0 && unblockedIds.length === 0) return;

  const store = useBlockedMembersStore.getState();
  if (blocked.length > 0) store.addMany(blocked);
  if (unblockedIds.length > 0) store.removeMany(unblockedIds);

  queryClient.setQueryData<MemberItem[]>(BLOCKED_MEMBERS_KEY, old => {
    const removeSet = new Set(unblockedIds);
    const blockedIds = new Set(blocked.map(m => String(m.userId)));
    const kept = (old ?? []).filter(
      m => !removeSet.has(String(m.userId)) && !blockedIds.has(String(m.userId)),
    );
    return [...blocked, ...kept];
  });

  if (unblockedIds.length > 0) queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
  if (blocked.length > 0) queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
}

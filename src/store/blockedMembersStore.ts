import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MemberItem } from '@/shared/types/user';

/**
 * 차단 멤버 스토어 (RN blockedMemberRepository 패리티).
 * RN의 SQLite 영속 + 메모리 Set 캐시를 데스크톱에서는 zustand persist(localStorage) + 파생 Set으로 대체.
 * - 순서 = 차단 최신순 (맨 앞이 최신). RN orderIndex 보존 규칙과 동일.
 * - 쓰기는 전부 이 스토어를 통과하고, Set 캐시는 쓰기 시마다 무효화 후 lazy 재구축.
 * - WS 핸들러 등 hot path는 isBlockedUser()(동기, 마운트 무관), UI는 useBlockedMembersStore 구독.
 */
interface BlockedMembersState {
  items: MemberItem[];
  /** 서버 목록 조회 결과로 전체 교체 (write-through) */
  replaceAll: (items: MemberItem[]) => void;
  /** 소켓/뮤테이션 델타 추가 — 신규를 맨 앞에, userId 중복 제거(멱등) */
  addMany: (items: MemberItem[]) => void;
  /** 소켓/뮤테이션 델타 제거 — 없는 userId는 no-op(멱등) */
  removeMany: (userIds: string[]) => void;
  /** 로그아웃 시 초기화 */
  clear: () => void;
}

let blockedIdSetCache: Set<string> | null = null;

export const useBlockedMembersStore = create<BlockedMembersState>()(
  persist(
    set => ({
      items: [],
      replaceAll: items => {
        blockedIdSetCache = null;
        set({ items });
      },
      addMany: incoming => {
        blockedIdSetCache = null;
        set(state => {
          const incomingIds = new Set(incoming.map(m => String(m.userId)));
          const kept = state.items.filter(m => !incomingIds.has(String(m.userId)));
          return { items: [...incoming, ...kept] };
        });
      },
      removeMany: userIds => {
        blockedIdSetCache = null;
        const removeSet = new Set(userIds.map(String));
        set(state => ({ items: state.items.filter(m => !removeSet.has(String(m.userId))) }));
      },
      clear: () => {
        blockedIdSetCache = null;
        set({ items: [] });
      },
    }),
    {
      name: 'blocked-members',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => () => {
        // cold start 복원 직후 Set 캐시 재구축 유도
        blockedIdSetCache = null;
      },
    },
  ),
);

/**
 * O(1) 차단 판별 — 메시지 수신 hot path용 (RN repository.isBlocked 패리티).
 * React 훅이 아니므로 WS 핸들러/유틸 어디서든 동기 호출 가능.
 */
export function isBlockedUser(userId: string | number | null | undefined): boolean {
  if (userId == null || userId === '') return false;
  if (!blockedIdSetCache) {
    blockedIdSetCache = new Set(
      useBlockedMembersStore.getState().items.map(m => String(m.userId)),
    );
  }
  return blockedIdSetCache.has(String(userId));
}

import type { WebSocketReceiveReadItemProps } from '@/shared/types/websocket';

/** 보류 등록 입력 — READ 핸들러가 받는 최소 필드 (readAt은 선택) */
export type PendingReadItem = Pick<WebSocketReceiveReadItemProps, 'roomId' | 'messageId' | 'userId'> &
  Partial<Pick<WebSocketReceiveReadItemProps, 'readAt'>>;

/**
 * 전역 PendingRead 레지스트리 (RN design §7.4 패리티)
 *
 * READ broadcast가 해당 메시지의 PUBLISH/FETCH보다 먼저 도착하는 ordering race를 흡수한다.
 * Zustand의 방 한정 `pendingReadEvents`를 대체하는 앱 세션 전역 보류함이며,
 * 메시지가 materialize되는 모든 경로(PUBLISH/FETCH)가 peek → 반영 → acknowledge 한다.
 *
 * - room → message → entry 중첩 Map (문자열 연결 key 충돌 회피)
 * - userId는 trim 정규화, 빈 ID 미저장, (roomId,messageId,userId)당 최신 readItem 1개
 * - 화면 이동/컨트롤러 unmount에서는 비우지 않는다. 실제 방 나가기·로그아웃에서만 제거.
 * - 서버 영구 읽음 원장을 대체하지 않는 ordering-race 흡수용 메모리.
 *   프로세스 종료분은 다음 진입 FETCH가 복구한다.
 */

export const PENDING_READ_TTL_MS = 5 * 60_000;
export const PENDING_READ_MAX_MESSAGES = 5_000;
export const PENDING_READ_SWEEP_INTERVAL_MS = 30_000;

export interface PendingReadEntry {
  roomId: string;
  messageId: string;
  readItemsByUserId: Map<string, PendingReadItem>;
  firstSeenAt: number;
  lastSeenAt: number;
}

// room → (messageId → entry)
const registry = new Map<string, Map<string, PendingReadEntry>>();

/** reader userId 정규화 — trim 후 빈 문자열은 무효. */
export function normalizeReaderId(id: unknown): string {
  return String(id ?? '').trim();
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/** TTL 만료/총량 상한 sweep — 브라우저에서 첫 add 시 지연 시작 (SSR 안전) */
function ensureSweepTimer() {
  if (sweepTimer || typeof window === 'undefined') return;
  sweepTimer = setInterval(() => {
    pendingReadRegistry.sweep(Date.now());
    if (pendingReadRegistry.size() === 0 && sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, PENDING_READ_SWEEP_INTERVAL_MS);
}

export const pendingReadRegistry = {
  /** READ batch 보류 추가. 동일 (roomId,messageId,userId)는 최신 readItem 1개만 유지. */
  add(readItems: PendingReadItem[], now: number): void {
    for (const item of readItems) {
      const roomId = item?.roomId;
      const messageId = item?.messageId;
      const userId = normalizeReaderId(item?.userId);
      if (!roomId || !messageId || !userId) continue;

      let byMessage = registry.get(roomId);
      if (!byMessage) {
        byMessage = new Map();
        registry.set(roomId, byMessage);
      }
      let entry = byMessage.get(messageId);
      if (!entry) {
        entry = {
          roomId,
          messageId,
          readItemsByUserId: new Map(),
          firstSeenAt: now,
          lastSeenAt: now,
        };
        byMessage.set(messageId, entry);
      }
      entry.readItemsByUserId.set(userId, item);
      entry.lastSeenAt = now;
    }
    if (this.size() > 0) ensureSweepTimer();
  },

  /** 해당 메시지에 보류 중인 readItem 목록 조회(비파괴). */
  peek(roomId: string, messageId: string): PendingReadItem[] {
    const entry = registry.get(roomId)?.get(messageId);
    return entry ? Array.from(entry.readItemsByUserId.values()) : [];
  },

  /** 방 단위 보류 entry 전체 조회(비파괴) — 현재 방 materialize 시 일괄 반영용. */
  peekRoom(roomId: string): PendingReadEntry[] {
    const byMessage = registry.get(roomId);
    return byMessage ? Array.from(byMessage.values()) : [];
  },

  /** 반영 성공 후 해당 reader들을 제거. 메시지의 reader가 모두 비면 entry 삭제. */
  acknowledge(roomId: string, messageId: string, userIds: string[]): void {
    const byMessage = registry.get(roomId);
    const entry = byMessage?.get(messageId);
    if (!byMessage || !entry) return;
    for (const uid of userIds) {
      entry.readItemsByUserId.delete(normalizeReaderId(uid));
    }
    if (entry.readItemsByUserId.size === 0) {
      byMessage.delete(messageId);
      if (byMessage.size === 0) registry.delete(roomId);
    }
  },

  /** 실제 방 나가기 시 해당 방의 보류 전체 제거. */
  removeRoom(roomId: string): void {
    registry.delete(roomId);
  },

  /** TTL 만료 + 총량 상한 초과분을 제거하고 evict된 entry를 반환. */
  sweep(now: number): PendingReadEntry[] {
    const evicted: PendingReadEntry[] = [];

    // 1) TTL 만료
    for (const [roomId, byMessage] of registry) {
      for (const [messageId, entry] of byMessage) {
        if (now - entry.firstSeenAt >= PENDING_READ_TTL_MS) {
          evicted.push(entry);
          byMessage.delete(messageId);
        }
      }
      if (byMessage.size === 0) registry.delete(roomId);
    }

    // 2) 총량 상한 초과 시 오래된 firstSeenAt부터 제거
    const total = this.size();
    if (total > PENDING_READ_MAX_MESSAGES) {
      const all: PendingReadEntry[] = [];
      for (const byMessage of registry.values()) {
        for (const entry of byMessage.values()) all.push(entry);
      }
      all.sort((a, b) => a.firstSeenAt - b.firstSeenAt);
      const removeCount = total - PENDING_READ_MAX_MESSAGES;
      for (let i = 0; i < removeCount; i++) {
        const entry = all[i];
        evicted.push(entry);
        const byMessage = registry.get(entry.roomId);
        byMessage?.delete(entry.messageId);
        if (byMessage && byMessage.size === 0) registry.delete(entry.roomId);
      }
    }

    return evicted;
  },

  /** 보류 중인 총 메시지 수. */
  size(): number {
    let total = 0;
    for (const byMessage of registry.values()) total += byMessage.size;
    return total;
  },

  /** 로그아웃 시 전체 초기화. */
  reset(): void {
    registry.clear();
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  },
};

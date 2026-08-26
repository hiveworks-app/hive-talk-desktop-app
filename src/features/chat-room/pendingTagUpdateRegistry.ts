/**
 * 태그 REMOVE→ADD 콤보 진행 중 메시지 마킹 (RN pendingTagUpdateRegistry 패리티, 데스크톱 변형).
 *
 * 서버는 ADD/REMOVE 처리 순서를 보장하지 않아, 3개 꽉 찬 메시지에서 "A 빼고 B 넣기"를
 * 동시에 보내면 ADD가 먼저 처리될 때 한도 초과(TA003)로 reject된다 (RN 2026-07-20 QA).
 * 콤보가 필요하면 REMOVE만 먼저 보내고, REMOVE 브로드캐스트 도착 시 대기 중인 ADD를 발사한다.
 * 중간 REMOVE 상태(유지분만 남음)는 화면에 반영하지 않아 낙관적 표시 깜빡임을 막는다.
 *
 * fallback: REMOVE 브로드캐스트가 끝내 오지 않는 비정상 경로(일시 유실 등)에서도
 * ADD가 조용히 사라지지 않도록 5초 후 강제 발사한다.
 */
const FALLBACK_MS = 5000;

interface PendingCombo {
  addTagIdList: string[];
  sendAdd: (tagIdList: string[]) => void;
  fallbackTimer: ReturnType<typeof setTimeout>;
}

const pendingByMessageId = new Map<string, PendingCombo>();

export const pendingTagUpdateRegistry = {
  /** 콤보 시작 — REMOVE 발사 직전에 호출 */
  mark(messageId: string, addTagIdList: string[], sendAdd: (tagIdList: string[]) => void): void {
    const existing = pendingByMessageId.get(messageId);
    if (existing) clearTimeout(existing.fallbackTimer);
    const fallbackTimer = setTimeout(() => {
      const entry = pendingByMessageId.get(messageId);
      if (!entry) return;
      pendingByMessageId.delete(messageId);
      entry.sendAdd(entry.addTagIdList);
    }, FALLBACK_MS);
    pendingByMessageId.set(messageId, { addTagIdList, sendAdd, fallbackTimer });
  },

  /**
   * REMOVE 브로드캐스트 도착 — 대기 중 ADD 발사.
   * @returns true면 콤보 진행 중이었음 → 중간 REMOVE 상태를 화면에 반영하지 말 것
   */
  consumeOnRemoveBroadcast(messageId: string): boolean {
    const entry = pendingByMessageId.get(messageId);
    if (!entry) return false;
    pendingByMessageId.delete(messageId);
    clearTimeout(entry.fallbackTimer);
    entry.sendAdd(entry.addTagIdList);
    return true;
  },
};

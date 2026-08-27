/**
 * 미확정 taggingId(-1 플레이스홀더) 태그의 제거 예약 (2026-08-27 QA).
 *
 * 태그를 붙여 전송한 직후 서버 PUB 에코는 taggingId를 -1로 실어주고, 실제 id는
 * 잠시 뒤 ADD_TAG 브로드캐스트로 확정된다. 이 창에서 태그 해제를 시도하면 "-1"로
 * REMOVE가 나가 서버가 거부 — 화면상 아무 일도 일어나지 않는다 (RN도 동일 잠복 결함).
 * 그래서 해제 요청을 예약해 두고, 확정 브로드캐스트가 실제 taggingId를 가져온 시점에
 * REMOVE를 발사한다 (pendingTagUpdateRegistry의 REMOVE→ADD 예약과 동일 패턴).
 *
 * fallback: 확정 브로드캐스트가 끝내 오지 않으면 10초 후 예약을 버린다
 * (조용히 폐기 — 태그는 붙은 채 남고, 사용자가 다시 눌러 재시도할 수 있다).
 */
const FALLBACK_MS = 10_000;

interface PendingRemove {
  tagIds: Set<number>;
  sendRemove: (taggingIdList: string[]) => void;
  fallbackTimer: ReturnType<typeof setTimeout>;
}

const pendingByMessageId = new Map<string, PendingRemove>();

/** 서버가 확정한 taggingId인가 — 전송 직후 PUB 에코의 -1 플레이스홀더/빈 값은 제거 요청에 못 쓴다 */
export const isConfirmedTaggingId = (taggingId: string | number | undefined | null): boolean =>
  taggingId != null && String(taggingId) !== '' && String(taggingId) !== '-1';

export const pendingTagRemoveRegistry = {
  /** 미확정 태그의 해제 예약 — 같은 메시지에 여러 건이면 tagId를 누적한다 */
  mark(messageId: string, tagId: number, sendRemove: (taggingIdList: string[]) => void): void {
    const existing = pendingByMessageId.get(messageId);
    if (existing) {
      existing.tagIds.add(tagId);
      existing.sendRemove = sendRemove;
      return;
    }
    const fallbackTimer = setTimeout(() => pendingByMessageId.delete(messageId), FALLBACK_MS);
    pendingByMessageId.set(messageId, { tagIds: new Set([tagId]), sendRemove, fallbackTimer });
  },

  /** 예약 취소 — 낙관적 복구(실패 안내) 발동 시 뒤늦은 성공이 안내와 모순되지 않도록 */
  cancel(messageId: string): void {
    const entry = pendingByMessageId.get(messageId);
    if (!entry) return;
    clearTimeout(entry.fallbackTimer);
    pendingByMessageId.delete(messageId);
  },

  /**
   * 태그 확정 브로드캐스트 도착 — 서버 최신 태그에서 실제 taggingId를 찾아 예약된 해제를 발사한다.
   * 아직 확정되지 않았으면(여전히 -1) 예약을 유지하고 다음 브로드캐스트를 기다린다.
   */
  consumeOnTagBroadcast(
    messageId: string,
    freshTags: Array<{ tagId: number; taggingId?: string }>,
  ): void {
    const entry = pendingByMessageId.get(messageId);
    if (!entry) return;
    const taggingIdList = freshTags
      .filter(t => entry.tagIds.has(Number(t.tagId)) && isConfirmedTaggingId(t.taggingId))
      .map(t => String(t.taggingId));
    if (taggingIdList.length === 0) return;
    pendingByMessageId.delete(messageId);
    clearTimeout(entry.fallbackTimer);
    entry.sendRemove(taggingIdList);
  },
};

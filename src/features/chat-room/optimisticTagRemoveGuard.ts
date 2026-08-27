/**
 * 낙관적 태그 해제의 실패 안전망 (2026-08-27 QA — UX 결정: 즉시 제거 + 실패 시 안내 복구).
 *
 * 칩을 즉시 내린 뒤 제한 시간 안에 서버 REMOVE 브로드캐스트가 도착하지 않으면
 * 스냅샷으로 복구하고 실패 스낵바를 띄운다 — "말없이 되살아나는" 혼란 방지.
 * 성공 신호(REMOVE 브로드캐스트)가 오면 disarm되어 아무 일도 하지 않는다.
 *
 * 타임아웃은 미확정 태그 경로(재조회 1회 + 제거 1회, 왕복 2회)까지 감안한 값.
 * 복구가 발동하면 지연 실행 예약(pendingTagRemoveRegistry)도 함께 취소해야
 * 뒤늦은 성공이 "실패했어요" 안내와 모순되지 않는다 (호출부 책임).
 */
const TIMEOUT_MS = 7000;

const armedByMessageId = new Map<string, ReturnType<typeof setTimeout>>();

export const optimisticTagRemoveGuard = {
  /** 낙관적 제거 직후 호출 — 같은 메시지에 재무장하면 이전 타이머는 교체된다 */
  arm(messageId: string, onTimeout: () => void): void {
    this.disarm(messageId);
    const timer = setTimeout(() => {
      armedByMessageId.delete(messageId);
      onTimeout();
    }, TIMEOUT_MS);
    armedByMessageId.set(messageId, timer);
  },

  /** 성공 신호(REMOVE 브로드캐스트) 도착 — 복구 취소 */
  disarm(messageId: string): void {
    const timer = armedByMessageId.get(messageId);
    if (timer) {
      clearTimeout(timer);
      armedByMessageId.delete(messageId);
    }
  },
};

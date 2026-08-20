/**
 * 협력멤버 초대장 도착 모달의 ack 워터마크 영속 (RN inviteArrivalNoticeStorage 패리티 — localStorage).
 * 사용자가 [닫기]/[확인하기]로 응답한 시점의 수신 건수를 기록해, 그 이하 건수로는 재안내하지 않는다.
 * 신규 도착분(count > ack)이 생겨야 다시 안내 (기획 확정 2026-07-15).
 */
const keyOf = (userId: string) => `invite-arrival-ack:${userId}`;

export function getInviteNoticeAckCount(userId: string): number {
  try {
    const raw = localStorage.getItem(keyOf(userId));
    const n = raw != null ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setInviteNoticeAckCount(userId: string, count: number): void {
  try {
    localStorage.setItem(keyOf(userId), String(Math.max(0, count)));
  } catch {
    /* 저장 실패는 무시 — 다음 진입에 재안내될 뿐 */
  }
}

/**
 * ack를 서버 진실(count)로 하향 클램프 — 오프라인 동안의 응답/취소/만료 반영.
 * ⚠️ INIT 수신 시점(서버 절대값)에서만 호출할 것 — 마운트 직후 미동기 0으로 클램프하면 ack가 소거된다.
 */
export function clampInviteNoticeAckCount(userId: string, count: number): void {
  const ack = getInviteNoticeAckCount(userId);
  if (ack > count) setInviteNoticeAckCount(userId, count);
}

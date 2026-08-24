/**
 * draft 방 생성 직후 1회 BEFORE 회수 마킹 (RN markDraftCreationBackfill 패리티).
 *
 * 방 생성 트랜잭션과 함께 서버가 발행하는 시스템 메시지(초대 공지)는 클라이언트가
 * 아직 SUB 하기 전이라 broadcast로 받지 못한다 → 첫 PUB 수신을 앵커로 삼아
 * 그 이전 메시지를 1회 FETCH_BEFORE로 회수한다.
 */
const pendingRooms = new Set<string>();

export function markDraftBackfill(roomId: string) {
  pendingRooms.add(roomId);
}

/** 마킹되어 있으면 소비(제거)하고 true — 첫 PUB 수신 시점에 한 번만 발동 */
export function consumeDraftBackfill(roomId: string): boolean {
  return pendingRooms.delete(roomId);
}

import { readCountCalculator } from '@/features/chat-room/domain';
import type { ParticipantItemsType } from '@/shared/types/chatRoom';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import {
  type Message,
  WS_MESSAGE_CONTENT_TYPE,
  isSystemMessageContentType,
} from '@/shared/types/websocket';

/**
 * FETCH 응답과 겹치는 기존 runtime 메시지에 서버의 신선 상태를 병합한다. (RN 패리티)
 *
 * fetch 병합은 중복 방지를 위해 이미 화면에 있는 메시지를 스킵하는데, 이때 응답에 실린
 * 더 신선한 정보까지 함께 버려져 화면이 서버와 어긋난다. 여기서 세 가지를 병합:
 *
 * ① 읽음(readItems) 단조 union — 진입 FETCH가 최신 메시지를 포함해도 상대 읽음 카운트가
 *    +1로 고착되는 실측 사례(RN 2026-07-20, 유령 구독으로 브로드캐스트 유실 후 FETCH가
 *    유일한 복구 경로). 읽음은 어떤 소스로 오든 후퇴하지 않아야 하므로 reader 추가만 하고
 *    절대 제거하지 않는다.
 * ② 발신자 표시(name/thumbnailProfileUrl) 동기화 — 서버 사본이 진실. 탈퇴 익명화
 *    ("알 수 없음" rename)처럼 스냅샷이 낡은 경우를 첫 진입 세션에서 즉시 교정한다.
 *    파서가 sender.isDeleted를 정규화한 뒤라 fresh.name은 항상 표시용 최종값이다.
 * ③ 파생 텍스트 동기화 — SUBMIT_INVITE 등 시스템 문구가 이름 미해석으로 축약 문구로
 *    굳은 경우 FETCH 사본(이름 포함 전체 문구)으로 교정한다. 단 신고 마스크·삭제
 *    tombstone은 보존한다 — 일반 payload가 되돌리지 못한다.
 *
 * 변경이 없으면 기존 배열/객체 참조를 그대로 반환해 불필요 리렌더를 막는다.
 */
export function mergeFetchedReadState(
  existing: Message[],
  fetched: Message[],
  participants: ParticipantItemsType[],
): { merged: Message[]; changed: boolean } {
  if (existing.length === 0 || fetched.length === 0) {
    return { merged: existing, changed: false };
  }

  const fetchedById = new Map(fetched.map(m => [m.id, m]));
  const hasParticipants = participants.length > 0;
  let changed = false;

  const merged = existing.map(msg => {
    const fresh = fetchedById.get(msg.id);
    if (!fresh) return msg;

    // ② 발신자 표시 동기화 — 시스템 메시지(EXIT 문구도 이름 기반) 포함 전 타입에 적용.
    //    undefined/null 혼재 비교로 인한 헛 리렌더 방지를 위해 null로 정규화해 비교.
    const freshThumb = fresh.thumbnailProfileUrl ?? null;
    let next = msg;
    if (fresh.name !== msg.name || freshThumb !== (msg.thumbnailProfileUrl ?? null)) {
      changed = true;
      next = { ...next, name: fresh.name, thumbnailProfileUrl: freshThumb };
    }

    // ③ 파생 텍스트 동기화 — 신고 마스크/삭제 tombstone은 일반 payload가 되돌리지 못한다
    const isMaskedExisting =
      msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK ||
      msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED;
    if (!isMaskedExisting && !msg.isDeleted && fresh.text && fresh.text !== msg.text) {
      changed = true;
      next = { ...next, text: fresh.text };
    }

    // ① 읽음 단조 union
    if (isSystemMessageContentType(msg.messageContentType)) return next;
    if (fresh.readUserIds.length === 0) return next;

    const union = new Set(
      msg.readUserIds.map(id => readCountCalculator.normalizeUserId(id)).filter(Boolean),
    );
    const sizeBefore = union.size;
    for (const id of fresh.readUserIds) {
      const normalized = readCountCalculator.normalizeUserId(id);
      if (normalized) union.add(normalized);
    }
    if (union.size === sizeBefore) return next;

    changed = true;
    const readUserIds = Array.from(union);
    if (!hasParticipants) {
      // 참여자 미로드(신규 방 직후 등) — "로드 후 전체 재계산"만 믿으면 그 재계산이 오지 않는
      // 경로(신규 방 + 사이드패널 미개방)에서 카운트가 초기값에 고정된다(3인 방 2 고정 실측).
      // 파서·READ 핸들러와 동일하게 totalUserCount 폴백으로 즉시 재계산한다.
      const totalCount = useChatRoomInfo.getState().totalUserCount ?? 0;
      const nextNotReadCount =
        totalCount > 0 ? Math.max(0, totalCount - readUserIds.length) : next.notReadCount;
      return { ...next, readUserIds, notReadCount: nextNotReadCount };
    }
    return {
      ...next,
      readUserIds,
      notReadCount: readCountCalculator.calculateNotReadCount({ readUserIds, participants }),
    };
  });

  return changed ? { merged, changed } : { merged: existing, changed: false };
}

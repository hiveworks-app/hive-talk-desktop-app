import { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';

/**
 * 채팅방 총 인원수(totalUserCount) 계산 단일 유틸. (RN roomUserCount 패리티)
 *
 * participants 배열에 "본인" 포함 여부가 데이터 소스마다 달라, 소비처가 ±1을
 * 직접 계산하면 오프셋이 어긋난다 (GM 방 인원수가 1 적게 표시되던 2026-08-26 감사 실측).
 * 인원수 계산은 반드시 이 모듈을 거친다 — 새 계산처에서 length에 직접 ±1 금지.
 *
 * | 소스                                      | 본인 포함 | 총원 계산      |
 * | ----------------------------------------- | --------- | -------------- |
 * | GM 목록 API roomModel.participants        | ❌ 제외   | length + 1     |
 * | EM 목록 API roomModel.participants        | ✅ 포함   | length         |
 * | GET …/{roomId}/participants (사이드패널)  | ✅ 포함   | length         |
 * | 신규 방 생성 초대 선택 목록(invitedUsers) | ❌ 제외   | length + 1     |
 * | DM (participantDetail 기반)               | —         | isExit ? 1 : 2 |
 */

/**
 * 채팅 목록 캐시의 roomModel.participants 기반 총원 (GM/EM 전용).
 * GM 응답은 본인 제외, EM 응답은 본인 포함으로 서버 직렬화 규약이 다르다.
 * DM은 participantDetail 기반이므로 countDMTotalUsers를 사용할 것.
 */
export function countRoomListTotalUsers(
  channelType: WebSocketChannelTypes,
  participants: ParticipantItemsType[] | null | undefined,
): number {
  const count = participants?.length ?? 0;
  return channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? count : count + 1;
}

/** GET …/{roomId}/participants 응답(본인 포함) 기반 총원. */
export function countParticipantsApiTotalUsers(
  participants: ParticipantItemsType[] | null | undefined,
): number {
  return participants?.length ?? 0;
}

/** 신규 방 생성 시 초대 선택 목록(본인 제외) 기반 총원. */
export function countInvitedTotalUsers(invitedUsers: ParticipantItemsType[]): number {
  return invitedUsers.length + 1;
}

/** DM 총원 — 상대방 나감 여부 기반 (participants 배열 미사용). */
export function countDMTotalUsers(otherUserIsExit: boolean): number {
  return otherUserIsExit ? 1 : 2;
}

/**
 * 알림 설정 타입 — 채팅/초대 마스터 토글 (서버 SSOT)
 *
 * 백엔드 API:
 *  - GET /app/push/settings              → 마스터 토글(채팅/초대) 상태 조회
 *  - PUT /app/all-rooms/push/(on|off)    → chat
 *  - PUT /app/all-invites/push/(on|off)  → invite
 */
export interface PushSettingsResponse {
  allRoomsPushEnabled: boolean;
  allInvitesPushEnabled: boolean;
}

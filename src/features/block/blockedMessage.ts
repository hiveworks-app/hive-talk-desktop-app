import { WS_MESSAGE_CONTENT_TYPE, type WebSocketMessageType } from '@/shared/types/websocket';

/**
 * 차단 메시지 정책 유틸 (RN features/block/blockedMessage.ts 패리티).
 * 접힘 문구는 메시지 타입별 4종 — 채팅방 버블·채팅 목록 미리보기가 공용으로 사용.
 */
export function getBlockedFoldText(type: WebSocketMessageType | string | undefined): string {
  switch (type) {
    case WS_MESSAGE_CONTENT_TYPE.IMAGE:
      return '차단된 사용자의 사진이에요.';
    case WS_MESSAGE_CONTENT_TYPE.MEDIA:
      return '차단된 사용자의 영상이에요.';
    case WS_MESSAGE_CONTENT_TYPE.FILE:
      return '차단된 사용자의 파일이에요.';
    default:
      return '차단된 사용자의 메시지예요.';
  }
}

/** 차단 관련 안내 문구 단일 출처 (RN BLOCK_MESSAGES 패리티) */
export const BLOCK_MESSAGES = {
  blocked: '차단되었어요.',
  blockManageHint: '차단멤버 관리에서 확인할 수 있어요.',
  blockFailed: '차단에 실패했어요.',
  unblocked: '차단해제되어 멤버목록에 다시 표시돼요.',
  unblockFailed: '차단 해제에 실패했어요.',
  blockConfirmDescription: '차단한 사용자의 메시지는 접힘 처리돼요.',
  unblockConfirmDescription: '차단해제하면, 메시지는 원복돼요.',
} as const;

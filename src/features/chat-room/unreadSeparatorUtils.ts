import type { Message } from '@/shared/types/websocket';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

/**
 * 메시지 타입별 예상 높이 (px)
 *
 * Bubble 컴포넌트 기준 실측값:
 * - 같은 그룹(mt-1.5=6px) + 한 줄 텍스트 ≈ 44px
 * - 다른 그룹(mt-3.5=14px) + 한 줄 텍스트 ≈ 52px
 * - 보수적(작게) 잡아야 구분선 누락을 방지할 수 있음
 */
const ESTIMATED_MESSAGE_HEIGHT: Record<string, number> = {
  [WS_MESSAGE_CONTENT_TYPE.TEXT]: 50, // 일반 텍스트 (1~2줄 기준, 마진 포함)
  [WS_MESSAGE_CONTENT_TYPE.IMAGE]: 250, // 이미지 (그리드/단일 평균)
  [WS_MESSAGE_CONTENT_TYPE.MEDIA]: 250, // 동영상
  [WS_MESSAGE_CONTENT_TYPE.FILE]: 100, // 파일 카드
  [WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE]: 44, // 시스템 메시지 (마진 포함)
  [WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT]: 44,
  [WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE]: 44,
  [WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE]: 44,
  [WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE]: 44,
  DEFAULT: 50,
};

/**
 * 안 읽은 메시지 목록의 예상 총 높이가 실제 메시지 표시 영역을 초과하는지 판단합니다.
 *
 * - 초과하면 → "여기까지 읽었어요." 구분선 표시 (한 화면 밖에 있는 메시지)
 * - 초과하지 않으면 → 구분선 미표시 (화면에 다 보이므로 불필요)
 *
 * @param messages 안 읽은 메시지 배열 (FETCH_AFTER 응답)
 * @param viewportHeight 전체 화면 높이 (useWindowDimensions().height)
 * @param occupiedHeight 헤더 + 입력창이 차지하는 높이 (onLayout으로 실측)
 * @returns 뷰포트 초과 여부
 */
export function exceedsViewportHeight(
  messages: Message[],
  viewportHeight: number,
  occupiedHeight: number,
): boolean {
  if (messages.length === 0) return false;

  const totalEstimatedHeight = messages.reduce((acc, message) => {
    const height =
      ESTIMATED_MESSAGE_HEIGHT[message.messageContentType] ?? ESTIMATED_MESSAGE_HEIGHT.DEFAULT;
    return acc + height;
  }, 0);

  // 실제 메시지 표시 영역 = 전체 화면 - (헤더 + 입력창)
  const actualVisibleHeight = viewportHeight - occupiedHeight;

  return totalEstimatedHeight > actualVisibleHeight;
}

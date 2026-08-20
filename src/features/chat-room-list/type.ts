import { RoomModelType } from '@/shared/types/chatRoom';
import { WebSocketPublishItem } from '@/shared/types/websocket';

export interface GetChatRoomListPayload {
  items: GetChatRoomListItemType[];
}

export interface GetChatRoomListItemType {
  messageList: WebSocketPublishItem[];
  roomModel: RoomModelType;
  notReadCount: number;
  /**
   * 목록 정렬 기준 시각 (차단 발신자 메시지 수신 시 freeze — 상단 이동 금지, RN sortAt 패리티).
   * 미설정이면 마지막 메시지 createdAt으로 정렬. 표시 시간은 항상 마지막 메시지 시각.
   */
  sortAt?: string;
}

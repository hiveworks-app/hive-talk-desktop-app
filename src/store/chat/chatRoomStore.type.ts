import type { WebSocketChannelTypes, WebSocketPublishItem } from '@/shared/types/websocket';

export interface ChatRoomInfo {
  roomId: string;
  roomName: string;
  channelType: WebSocketChannelTypes;
  totalUserCount: number;
  otherUserIsExit: boolean;
  /** DM 상대가 회원탈퇴/소속해제로 제거됨 — 입력창 비활성 + 자동초대 차단 (정책 dm.md, GM/EM은 항상 false) */
  otherUserIsRemoved: boolean;
  invitedUserIds: string[];
  lastMessage: WebSocketPublishItem | null;
  initialNotReadCount: number;
}

export interface ChatRoomInfoState extends ChatRoomInfo {
  setChatRoomInfo: (info: Partial<ChatRoomInfo>) => void;
  resetChatRoomInfo: () => void;
}

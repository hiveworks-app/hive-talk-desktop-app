'use client';

import { create } from 'zustand';
import {
  WS_CHANNEL_TYPE,
  type WebSocketChannelTypes,
  type WebSocketPublishItem,
} from '@/shared/types/websocket';

interface ChatRoomInfo {
  roomId: string;
  roomName: string;
  channelType: WebSocketChannelTypes;
  totalUserCount: number;
  otherUserIsExit: boolean;
  invitedUserIds: string[];
  lastMessage: WebSocketPublishItem | null;
}

interface ChatRoomInfoState extends ChatRoomInfo {
  setChatRoomInfo: (info: Partial<ChatRoomInfo>) => void;
  resetChatRoomInfo: () => void;
}

const initChatRoomInfo: ChatRoomInfo = {
  roomId: '',
  roomName: '',
  channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
  totalUserCount: 0,
  otherUserIsExit: false,
  invitedUserIds: [],
  lastMessage: null,
};

export const useChatRoomInfo = create<ChatRoomInfoState>(set => ({
  ...initChatRoomInfo,
  setChatRoomInfo: info => set(state => ({ ...state, ...info })),
  resetChatRoomInfo: () => set({ ...initChatRoomInfo }),
}));

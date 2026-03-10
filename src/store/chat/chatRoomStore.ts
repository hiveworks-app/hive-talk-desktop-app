'use client';

import { create } from 'zustand';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import type { ChatRoomInfo, ChatRoomInfoState } from './chatRoomStore.type';

export type { ChatRoomInfo, ChatRoomInfoState } from './chatRoomStore.type';

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

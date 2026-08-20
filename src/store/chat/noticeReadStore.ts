'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

/**
 * 공지 읽음 표시 스토어 (RN noticeReadStore 패리티 — AsyncStorage 대신 localStorage).
 * 사용자·채널·방 단위로 마지막으로 읽은 noticeId를 저장해, 새 공지가 등록되면
 * 배너 아이콘이 빨간 dot(IconNoticeNew)으로 전환된다. 상세 열람 시 읽음 처리.
 */

interface NoticeReadKeyParams {
  userId: string;
  roomId: string;
  channelType: WebSocketChannelTypes;
}

interface NoticeReadState {
  readNoticeByRoom: Record<string, number>;
  markNoticeAsRead: (params: NoticeReadKeyParams & { noticeId: number }) => void;
  isNoticeRead: (params: NoticeReadKeyParams & { noticeId: number }) => boolean;
}

export const createNoticeReadKey = ({ userId, roomId, channelType }: NoticeReadKeyParams) =>
  `${userId}:${channelType}:${roomId}`;

export const useNoticeReadStore = create<NoticeReadState>()(
  persist(
    (set, get) => ({
      readNoticeByRoom: {},
      markNoticeAsRead: params =>
        set(state => {
          const key = createNoticeReadKey(params);
          if (state.readNoticeByRoom[key] === params.noticeId) {
            return state;
          }
          return {
            readNoticeByRoom: {
              ...state.readNoticeByRoom,
              [key]: params.noticeId,
            },
          };
        }),
      isNoticeRead: params => {
        const key = createNoticeReadKey(params);
        return get().readNoticeByRoom[key] === params.noticeId;
      },
    }),
    {
      name: 'chat-notice-read',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ readNoticeByRoom: state.readNoticeByRoom }),
    },
  ),
);

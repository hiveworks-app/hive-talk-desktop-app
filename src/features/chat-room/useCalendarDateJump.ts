'use client';

import { useCallback, useState } from 'react';
import {
  apiGetDMFirstOnAfter,
  apiGetDMFirstOnBefore,
  apiGetEMFirstOnAfter,
  apiGetEMFirstOnBefore,
  apiGetGMFirstOnAfter,
  apiGetGMFirstOnBefore,
} from '@/features/chat-room/api';
import { createWsMessageParser } from '@/features/chat-room/createWsMessageParser';
import { Message, WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useUIStore } from '@/store/uiStore';

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface UseCalendarDateJumpOptions {
  roomId: string;
  channelType: WebSocketChannelTypes;
  /** 대상 메시지 인덱스로 스크롤 (검색 포커스와 동일 메커니즘) */
  scrollToIndex: (index: number) => void;
}

/**
 * 캘린더 날짜 검색 — 선택한 날짜의 첫 메시지로 점프 (RN handleCalendarDateSelect 패리티).
 * 1) 로드된 메시지에서 해당 날짜를 먼저 찾고,
 * 2) 없으면 first-on before/after API로 앞뒤 50건씩 회수해 메시지 목록을 교체 후 스크롤한다.
 */
export function useCalendarDateJump({ roomId, channelType, scrollToIndex }: UseCalendarDateJumpOptions) {
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const handleCalendarDateSelect = useCallback(
    async (date: Date) => {
      const targetDateStr = toDateKey(date);
      if (!roomId) return;

      // 1. 이미 로드된 메시지에서 먼저 찾기
      const messages = useChatRoomRuntimeStore.getState().messages;
      const localIndex = messages.findIndex(
        msg => !!msg.createdAt && toDateKey(new Date(msg.createdAt)) === targetDateStr,
      );
      if (localIndex !== -1) {
        scrollToIndex(localIndex);
        return;
      }

      // 2. 로드되지 않은 경우 → first-on API로 해당 날짜 기준 앞뒤 메시지 조회
      setIsCalendarLoading(true);
      try {
        const getFirstOnBefore =
          channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE
            ? apiGetGMFirstOnBefore
            : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
              ? apiGetEMFirstOnBefore
              : apiGetDMFirstOnBefore;
        const getFirstOnAfter =
          channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE
            ? apiGetGMFirstOnAfter
            : channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE
              ? apiGetEMFirstOnAfter
              : apiGetDMFirstOnAfter;

        // 앞뒤 메시지를 동시에 요청 (각 50건, 앵커 포함)
        const [beforeRes, afterRes] = await Promise.all([
          getFirstOnBefore(roomId, targetDateStr, 50),
          getFirstOnAfter(roomId, targetDateStr, 50),
        ]);

        const loginUserId = useAuthStore.getState().user?.id ?? '';
        // 참여자 스냅샷 없이 파싱 — notReadCount는 totalUserCount 폴백으로 근사,
        // 참여자 로드 시 recalculateAllMessagesNotReadCount가 보정 (RN 동일 패턴)
        const parseWsMessage = createWsMessageParser({
          getLoginUserId: () => loginUserId,
          getParticipants: () => [],
          getTotalUserCount: () => useChatRoomInfo.getState().totalUserCount,
        });

        const beforeParsed = (beforeRes.payload.items ?? [])
          .map(item => parseWsMessage({ item }))
          .filter((m): m is Message => m !== null);
        const afterParsed = (afterRes.payload.items ?? [])
          .map(item => parseWsMessage({ item }))
          .filter((m): m is Message => m !== null);

        // 중복 제거 후 시간순 병합
        const allIds = new Set<string>();
        const merged: Message[] = [];
        [...beforeParsed, ...afterParsed].forEach(m => {
          if (!allIds.has(m.id)) {
            allIds.add(m.id);
            merged.push(m);
          }
        });
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (merged.length === 0) {
          useUIStore.getState().showSnackbar({ message: '해당 날짜의 메시지가 없어요.', state: 'error' });
          return;
        }

        // 해당 날짜 첫 메시지(피벗) — 없으면 회수 구간의 첫 메시지
        const pivotMsg = merged.find(m => toDateKey(new Date(m.createdAt)) === targetDateStr);
        const pivotId = pivotMsg?.id ?? merged[0].id;

        // 메시지 교체 (앞뒤 포함) — 경계 커서가 남았을 수 있으므로 더보기 플래그 갱신
        useChatRoomRuntimeStore.setState(state => ({
          messages: merged,
          loading: {
            ...state.loading,
            hasMoreBefore: beforeParsed.length >= 50,
            hasMoreAfter: afterParsed.length >= 50,
            isBeforeLoading: false,
            isAfterLoading: false,
          },
        }));

        // 레이아웃 안정화 후 피벗으로 스크롤
        setTimeout(() => {
          const currentMessages = useChatRoomRuntimeStore.getState().messages;
          const targetIndex = currentMessages.findIndex(m => m.id === pivotId);
          if (targetIndex !== -1) scrollToIndex(targetIndex);
        }, 300);
      } catch (error) {
        console.warn('[CALENDAR] 날짜 이동 API 실패:', error);
        useUIStore.getState().showSnackbar({ message: '날짜 이동에 실패했어요. 잠시 후 다시 시도해주세요.', state: 'error' });
      } finally {
        setIsCalendarLoading(false);
      }
    },
    [roomId, channelType, scrollToIndex],
  );

  return { handleCalendarDateSelect, isCalendarLoading };
}

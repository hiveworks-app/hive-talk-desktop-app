'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PUSH_SETTINGS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetPushSettings,
  apiPushOffAllInvites,
  apiPushOffAllRooms,
  apiPushOnAllInvites,
  apiPushOnAllRooms,
} from './api';
import type { PushSettingsResponse } from './type';

/** 5분 룰 — 5분 이내 재진입은 noop, 초과 시 자동 refetch (모바일과 동일 정책) */
const PUSH_SETTINGS_STALE_TIME_MS = 5 * 60 * 1000;

/** 알림 마스터 토글(채팅/초대) 상태 조회. 서버가 SSOT, 화면은 본 query를 표시. */
export const useGetPushSettings = () => {
  const accessToken = useAuthStore(s => s.accessToken);
  return useQuery({
    queryKey: PUSH_SETTINGS_KEY,
    queryFn: async () => {
      const res = await apiGetPushSettings();
      return res.payload;
    },
    staleTime: PUSH_SETTINGS_STALE_TIME_MS,
    enabled: !!accessToken,
  });
};

/**
 * 채팅/초대 토글 공통 optimistic mutation 팩토리.
 * - onMutate: 즉시 캐시 반영(낙관적) + 이전 값 보관
 * - onError: 이전 값으로 rollback
 * - onSettled: 서버와 최종 정합을 위해 refetch
 */
function useTogglePush(
  field: 'allRoomsPushEnabled' | 'allInvitesPushEnabled',
  onMutation: (enabled: boolean) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => onMutation(enabled),
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: PUSH_SETTINGS_KEY });
      const previous = queryClient.getQueryData<PushSettingsResponse>(PUSH_SETTINGS_KEY);
      queryClient.setQueryData<PushSettingsResponse | undefined>(PUSH_SETTINGS_KEY, prev =>
        prev ? { ...prev, [field]: enabled } : prev,
      );
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PUSH_SETTINGS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PUSH_SETTINGS_KEY });
    },
  });
}

/** 채팅방 전체 푸시 ON/OFF */
export const useToggleChatPush = () =>
  useTogglePush('allRoomsPushEnabled', enabled => (enabled ? apiPushOnAllRooms() : apiPushOffAllRooms()));

/** 초대 푸시 ON/OFF */
export const useToggleInvitePush = () =>
  useTogglePush('allInvitesPushEnabled', enabled => (enabled ? apiPushOnAllInvites() : apiPushOffAllInvites()));

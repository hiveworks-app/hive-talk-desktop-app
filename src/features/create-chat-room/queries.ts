'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDMCreate, apiGMCreate } from '@/features/create-chat-room/api';
import { GMCreateRequestProps } from '@/features/create-chat-room/type';
import { getErrorMessage } from '@/shared/api';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { useUIStore } from '@/store';

export const useCreateDM = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiDMCreate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
      showSnackbar({
        message: '채팅방을 생성했습니다.',
        state: 'success',
      });
    },
    // onError는 CreateRoomDialog에서 직접 처리 (중복 DM 방 → 기존 방 이동 로직)
  });
};

export const useCreateGM = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: (data: GMCreateRequestProps) => apiGMCreate(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
      showSnackbar({
        message: '채팅방을 생성했습니다.',
        state: 'success',
      });
    },
    onError: (err: unknown) => {
      showSnackbar({
        message: getErrorMessage(err, '채팅방 생성에 실패했습니다.'),
        state: 'error',
      });
    },
  });
};

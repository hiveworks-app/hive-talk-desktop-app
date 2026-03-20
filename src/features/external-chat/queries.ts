'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';
import { apiEMCreate, apiInviteToEMRoom } from './api';
import type { EMCreateRequestProps } from './type';

export const useCreateEM = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (data: EMCreateRequestProps) => apiEMCreate(data),
    onSuccess: () => {
      showSnackbar({ message: '외부 채팅방을 생성했습니다.', state: 'success' });
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: isApiError(err) ? err.message : '외부 채팅방 생성에 실패했습니다.', state: 'error' });
    },
  });
};

export const useInviteToEM = () => {
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: ({ roomId, userIds }: { roomId: string; userIds: string[] }) =>
      apiInviteToEMRoom(roomId, userIds),
    onSuccess: () => {
      showSnackbar({ message: '멤버를 초대했습니다.', state: 'success' });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: isApiError(err) ? err.message : '초대에 실패했습니다.', state: 'error' });
    },
  });
};

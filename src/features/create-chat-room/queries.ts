'use client';

import { useMutation } from '@tanstack/react-query';
import { apiDMCreate, apiGMCreate } from '@/features/create-chat-room/api';
import { GMCreateRequestProps } from '@/features/create-chat-room/type';
import { useUIStore } from '@/store';

export const useCreateDM = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiDMCreate,
    onSuccess: async () => {
      showSnackbar({
        message: '채팅방을 생성했습니다.',
        state: 'success',
      });
    },
    onError: async () => {
      showSnackbar({
        message: '채팅방 생성에 실패했습니다.',
        state: 'error',
      });
    },
  });
};

export const useCreateGM = () => {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: (data: GMCreateRequestProps) => apiGMCreate(data),
    onSuccess: async () => {
      showSnackbar({
        message: '채팅방을 생성했습니다.',
        state: 'success',
      });
    },
    onError: async () => {
      showSnackbar({
        message: '채팅방 생성에 실패했습니다.',
        state: 'error',
      });
    },
  });
};

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { getErrorMessage } from '@/shared/api';
import { useUIStore } from '@/store';
import { apiCheckDuplicateEM, apiEMCreate, apiInviteToEMRoom } from './api';
import type { EMCreateRequestProps } from './type';

/** 협력방 생성 전 중복 검사 (성공/실패는 호출부에서 분기) */
export const useCheckDuplicateEM = () =>
  useMutation({
    mutationFn: (userIdList: string[]) => apiCheckDuplicateEM({ userIdList }),
  });

export const useCreateEM = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (data: EMCreateRequestProps) => apiEMCreate(data),
    onSuccess: () => {
      // 방 생성 토스트는 노출하지 않음 — 실제로는 첫 메시지 전송 시 자연스럽게 생성되는 흐름이라
      // "생성했습니다" 안내가 사용자 흐름과 맞지 않음 (사용자 요청)
      queryClient.invalidateQueries({ queryKey: EM_ROOM_LIST_KEY });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '외부 채팅방 생성에 실패했습니다.'), state: 'error' });
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
      showSnackbar({ message: getErrorMessage(err, '초대에 실패했습니다.'), state: 'error' });
    },
  });
};

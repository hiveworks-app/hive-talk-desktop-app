'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXTERNAL_MEMBERS_KEY,
  MEMBERS_KEY,
  PINNED_MEMBERS_KEY,
  RECEIVED_INVITES_KEY,
} from '@/shared/config/queryKeys';
import { getErrorMessage } from '@/shared/api';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetExternalMembers,
  apiGetReceivedInvites,
  apiInviteExternalUser,
  apiCancelExternalInvite,
  apiRespondInvite,
} from './api';
import type { InviteExternalUserRequest, InviteResultType, ReceivedInviteItem } from './type';

export const useGetExternalMembers = (search?: string) => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: EXTERNAL_MEMBERS_KEY(search),
    queryFn: async () => {
      const res = await apiGetExternalMembers(search);
      return res.payload.items;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};

export const useInviteExternalUser = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (data: InviteExternalUserRequest) => apiInviteExternalUser(data),
    onSuccess: () => {
      showSnackbar({ message: '초대를 보냈습니다.', state: 'success' });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '초대에 실패했습니다.'), state: 'error' });
    },
  });
};

export const useCancelExternalInvite = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: (userId: number) => apiCancelExternalInvite(userId),
    onSuccess: () => {
      showSnackbar({ message: '초대를 취소했습니다.', state: 'success' });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '초대 취소에 실패했습니다.'), state: 'error' });
    },
  });
};

/** 받은 초대 목록 조회 (원본 → UI 아이템 정규화) */
export const useReceivedInvites = () => {
  const { user } = useAuthStore();

  return useQuery<ReceivedInviteItem[]>({
    queryKey: RECEIVED_INVITES_KEY,
    queryFn: async () => {
      const res = await apiGetReceivedInvites();
      return res.payload.items.map(item => ({
        inviteId: item.inviteId,
        userId: item.userModel.userId,
        name: item.userModel.name,
        companyName: item.userModel.companyName,
        profileUrl: item.userModel.profileUrl,
        result: item.result,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
};

/** 받은 초대 수락/거절 */
export const useRespondInvite = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: ({ inviteId, result }: { inviteId: string; result: InviteResultType }) =>
      apiRespondInvite(inviteId, result),
    onSuccess: (_res, { result }) => {
      queryClient.invalidateQueries({ queryKey: RECEIVED_INVITES_KEY });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
      if (result === 'ACCEPT') {
        // 수락 시 멤버/관심멤버 목록 갱신 (협력멤버로 추가됨)
        queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
        queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
        showSnackbar({ message: '멤버목록에 추가됐어요.', state: 'success' });
      } else {
        showSnackbar({ message: '거절한 초대가 목록에서 삭제됐어요.', state: 'info' });
      }
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '처리에 실패했습니다.'), state: 'error' });
    },
  });
};

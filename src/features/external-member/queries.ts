'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXTERNAL_MEMBERS_KEY,
  MEMBERS_KEY,
  PINNED_MEMBERS_KEY,
  RECEIVED_INVITES_KEY,
} from '@/shared/config/queryKeys';
import { getErrorMessage } from '@/shared/api';
import { apiDeletePinnedMember } from '@/features/pinned-members/api';
import type { MemberItem } from '@/shared/types/user';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetExternalMembers,
  apiGetReceivedInvites,
  apiInviteExternalUser,
  apiCancelExternalInvite,
  apiRespondInvite,
  apiDeleteExternalContact,
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

/**
 * 외부친구(협력멤버) 삭제.
 * 고정(관심멤버) 상태면 contact 삭제 전에 먼저 unpin — 역순이면 서버에 stale pinned 잔존
 * (재-친구 시 isPinned/관심멤버 섹션 불일치). unpin 실패해도 삭제는 진행(이후 invalidate가 정정).
 */
export const useDeleteExternalContact = () => {
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);

  return useMutation({
    mutationFn: async (userId: string) => {
      const pinned = queryClient.getQueryData<MemberItem[]>(PINNED_MEMBERS_KEY);
      const wasPinned = pinned?.some(m => String(m.userId) === userId) ?? false;
      if (wasPinned) {
        try {
          await apiDeletePinnedMember([Number(userId)]);
        } catch (err) {
          console.warn('[deleteExternalContact] 관심멤버 자동 해제 실패:', err);
        }
      }
      return apiDeleteExternalContact(Number(userId));
    },
    onSuccess: (_res, userId) => {
      queryClient.setQueryData<MemberItem[]>(
        PINNED_MEMBERS_KEY,
        prev => prev?.filter(m => String(m.userId) !== userId) ?? [],
      );
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
      queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
      showSnackbar({ message: '외부 멤버를 삭제했습니다.', state: 'info' });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '삭제에 실패했습니다.'), state: 'error' });
    },
  });
};

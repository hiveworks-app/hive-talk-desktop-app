'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXTERNAL_MEMBERS_KEY,
  MEMBERS_KEY,
  PINNED_MEMBERS_KEY,
  RECEIVED_INVITES_KEY,
  SENT_INVITES_KEY,
} from '@/shared/config/queryKeys';
import { getErrorMessage } from '@/shared/api';
import { apiDeletePinnedMember } from '@/features/pinned-members/api';
import type { MemberItem } from '@/shared/types/user';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import {
  apiGetExternalMembers,
  apiGetSentInvites,
  apiInviteExternalUser,
  apiInviteExternalByEmail,
  apiInviteExternalByPhone,
  apiSearchExternalByEmail,
  apiSearchExternalByPhone,
  apiCancelExternalInvite,
  apiRespondInvite,
  apiDeleteExternalContact,
} from './api';
import { fetchReceivedInvites, resyncReceivedInvitesFromServer } from './receivedInviteSync';
import type { InviteExternalUserRequest, InviteResultType, ReceivedInviteItem, SentInviteItem } from './type';

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

/** 이메일로 외부 사람 검색 */
export const useSearchExternalByEmail = () =>
  useMutation({ mutationFn: (email: string) => apiSearchExternalByEmail(email) });

/** 연락처(전화번호)로 외부 사람 검색 */
export const useSearchExternalByPhone = () =>
  useMutation({ mutationFn: (phoneFull: string) => apiSearchExternalByPhone(phoneFull) });

/** 이메일로 외부 사람 초대 (성공 시 보낸초대·외부멤버 목록 갱신) */
export const useInviteExternalByEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => apiInviteExternalByEmail({ email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SENT_INVITES_KEY });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
  });
};

/** 연락처(전화번호)로 외부 사람 초대 (성공 시 보낸초대·외부멤버 목록 갱신) */
export const useInviteExternalByPhone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phoneFull: string) => apiInviteExternalByPhone({ phoneFull }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SENT_INVITES_KEY });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
    },
  });
};

/** 보낸 초대 목록 조회 (원본 → UI 아이템 정규화) */
export const useSentInvites = () => {
  const { user } = useAuthStore();

  return useQuery<SentInviteItem[]>({
    queryKey: SENT_INVITES_KEY,
    queryFn: async () => {
      const res = await apiGetSentInvites();
      return res.payload.items.map(item => ({
        inviteId: item.inviteId,
        userId: item.userModel.userId,
        name: item.userModel.name,
        profileUrl: item.userModel.profileUrl,
        sentAt: item.receivedAt,
        status: item.result,
      }));
    },
    enabled: !!user?.id,
    // 진입마다 재조회 (RN staleTime 미지정 패리티) — WS 미수신 변동(만료 등) 반영 지연 방지
    staleTime: 0,
  });
};

/** 받은 초대 목록 조회 (원본 → UI 아이템 정규화) */
export const useReceivedInvites = () => {
  const { user } = useAuthStore();

  return useQuery<ReceivedInviteItem[]>({
    queryKey: RECEIVED_INVITES_KEY,
    queryFn: fetchReceivedInvites,
    enabled: !!user?.id,
    // 진입마다 재조회 (RN staleTime 미지정 패리티) — WS 미수신 변동(만료 등) 반영 지연 방지
    staleTime: 0,
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
      // 본인 응답은 WS 이벤트가 없어 카운터가 안 내려간다 — 실측으로 카운터·ack 동기화.
      // 안 하면 ack 워터마크가 응답 전 건수에 고착돼 다음 초대 도착 모달이 영영 안 뜬다.
      resyncReceivedInvitesFromServer(queryClient);
      if (result === 'ACCEPT') {
        // 수락 시 멤버/관심멤버 목록 갱신 (협력멤버로 추가됨)
        queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
        queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
        showSnackbar({ message: '멤버목록에 추가됐어요.', state: 'success' });
      } else {
        // state error = X 아이콘 표기용 (RN 패리티 — 거절/삭제류 안내는 X 아이콘, 배경은 동일 다크 pill)
        showSnackbar({ message: '거절한 초대가 목록에서 삭제됐어요.', state: 'error' });
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
      // 서버 unpin 실패 경로의 stale 잔존 방지 — 즉시 제거 후 서버 재확인 (RN 패리티)
      queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
      queryClient.invalidateQueries({ queryKey: EXTERNAL_MEMBERS_KEY() });
      queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
      // state error = X 아이콘 표기용 (RN 패리티 — 삭제 완료 안내는 X 아이콘)
      showSnackbar({ message: '멤버목록에서 삭제되었어요.', state: 'error' });
    },
    onError: (err: unknown) => {
      showSnackbar({ message: getErrorMessage(err, '멤버 삭제에 실패했어요.'), state: 'error' });
    },
  });
};

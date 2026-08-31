import type { QueryClient } from '@tanstack/react-query';
import { RECEIVED_INVITES_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { apiGetReceivedInvites } from './api';
import { clampInviteNoticeAckCount } from './inviteArrivalNoticeStorage';
import type { ReceivedInviteItem } from './type';

/** 받은 초대 목록 fetch + 정규화 — 쿼리(useReceivedInvites)와 실측 동기화가 공유 */
export const fetchReceivedInvites = async (): Promise<ReceivedInviteItem[]> => {
  const res = await apiGetReceivedInvites();
  return res.payload.items.map(item => ({
    inviteId: item.inviteId,
    userId: item.userModel.userId,
    name: item.userModel.name,
    companyName: item.userModel.companyName,
    profileUrl: item.userModel.profileUrl,
    result: item.result,
  }));
};

/**
 * 받은 초대 목록을 서버에서 실측해 카운터·목록 캐시·ack 워터마크를 절대값으로 재동기화.
 *
 * 카운터(externalReceivedCount)는 WS 증감(±1)만으로는 어긋나는 경로가 있다:
 * - 목록 캐시 미로딩 상태의 중복 브로드캐스트 → 이중 +1 / 감소 누락
 * - 본인이 초대에 응답(수락·거절) → 대응하는 WS 이벤트가 없어 감소 자체가 없음
 * 어긋난 카운터는 도착 모달의 "N건" 오표시와, ack 워터마크 고착으로 인한
 * 다음 초대 안내 유실(두 번째부터 모달 미표시)로 이어진다 — 표시값은 항상 서버 진실을 따른다.
 * 실패 시 낙관값이 그대로 남고, 다음 재연결 INIT 절대값이 보정한다.
 */
export function resyncReceivedInvitesFromServer(queryClient: QueryClient) {
  void fetchReceivedInvites()
    .then(items => {
      queryClient.setQueryData<ReceivedInviteItem[]>(RECEIVED_INVITES_KEY, items);
      useMemberInviteStore.getState().setExternalReceivedCount(items.length);
      // 실측이 낙관값보다 작아졌으면 ack도 내려 다음 도착 안내가 막히지 않게 (INIT과 동일)
      const userId = useAuthStore.getState().user?.id;
      if (userId != null) clampInviteNoticeAckCount(String(userId), items.length);
    })
    .catch(() => {});
}

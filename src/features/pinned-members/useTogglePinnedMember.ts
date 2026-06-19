'use client';

import { useCallback, useRef } from 'react';
import {
  useDeletePinnedMember,
  useGetPinnedMembers,
  useReplacePinnedMembers,
} from '@/features/pinned-members/queries';
import { useUIStore } from '@/store';

/**
 * 관심멤버 별 토글 비즈니스 훅 (모바일 UserProfileScreen 패리티).
 * - 등록: PUT(전체 교체) — 단건 추가 API가 없어 [현재 고정 목록 + 신규 id]로 끝에 추가한다.
 * - 해제: DELETE.
 * 연타 시 중복 발사 방지를 위해 동기 ref 가드를 둔다(isPending은 setState라 같은 프레임 다중 클릭을 못 막음).
 */
export function useTogglePinnedMember() {
  const { data: pinnedMembers = [], isLoading: isPinnedLoading } = useGetPinnedMembers();
  const { mutateAsync: replacePinned, isPending: isAdding } = useReplacePinnedMembers();
  const { mutateAsync: deletePinned, isPending: isRemoving } = useDeletePinnedMember();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const inFlightRef = useRef(false);

  const isPinned = useCallback(
    (userId: string) => pinnedMembers.some(m => String(m.userId) === String(userId)),
    [pinnedMembers],
  );

  const toggle = useCallback(
    async (userId: string) => {
      // 목록 로딩 중엔 차단 — PUT(전체 교체)에 빈/부분 목록이 들어가 기존 고정이 날아가는 것 방지
      if (inFlightRef.current || isPinnedLoading) return;
      inFlightRef.current = true;
      const pinned = pinnedMembers.some(m => String(m.userId) === String(userId));
      try {
        if (pinned) {
          await deletePinned([Number(userId)]);
          showSnackbar({ message: '관심멤버가 해제되었어요.', state: 'info' });
        } else {
          const currentIds = pinnedMembers.map(m => Number(m.userId));
          await replacePinned([...currentIds, Number(userId)]);
          showSnackbar({ message: '관심멤버로 등록되었어요.', state: 'success' });
        }
      } catch {
        showSnackbar({
          message: pinned ? '관심멤버 해제에 실패했어요.' : '관심멤버 등록에 실패했어요.',
          state: 'error',
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [pinnedMembers, deletePinned, replacePinned, showSnackbar, isPinnedLoading],
  );

  return { isPinned, toggle, isPending: isAdding || isRemoving, isLoading: isPinnedLoading };
}

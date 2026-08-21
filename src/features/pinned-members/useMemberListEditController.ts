'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetBlockedMembers } from '@/features/block/queries';
import { useGetMembers } from '@/features/members/queries';
import {
  useDeletePinnedMember,
  useGetPinnedMembers,
  useReplacePinnedMembers,
} from '@/features/pinned-members/queries';
import { PINNED_MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';

/**
 * 멤버목록 편집(관심멤버 드래그 정렬 + 일괄 등록/해제) 컨트롤러 (RN useMemberListEditController 패리티).
 *
 * 상태를 순서(order)와 소속(membership)으로 분리한다:
 * - pinnedOrder: 드래그 리오더·저장에 사용 (순서 변경 시만 갱신)
 * - pinnedIdSet: isChecked/isPinned 콜백에 사용 (소속 변경 시만 갱신)
 * → reorderPinned가 pinnedIdSet을 변경하지 않으므로 콜백 참조가 안정적이다.
 */
export function useMemberListEditController() {
  const queryClient = useQueryClient();
  const { data: serverPinnedMembers, isLoading: isPinnedLoading } = useGetPinnedMembers();
  const { data: allMembersData } = useGetMembers();
  const allMembers = useMemo(() => allMembersData ?? [], [allMembersData]);
  const { data: blockedMembers = [] } = useGetBlockedMembers();
  const replaceMutation = useReplacePinnedMembers();
  const deleteMutation = useDeletePinnedMember();

  // 전체멤버 섹션 노출용 — 차단 멤버 제외. 노출되면 관심멤버로 새로 등록할 수 있는데
  // 멤버목록에서는 차단 필터로 숨겨져 "등록했는데 안 보이는" 유령 상태가 된다.
  // 관심멤버 매핑·캐시 쓰기는 서버 진실(allMembers 원본)을 유지한다. (RN은 미필터 — 데스크톱 정책)
  const selectableMembers = useMemo(() => {
    const blockedIdSet = new Set(blockedMembers.map(m => String(m.userId)));
    return allMembers.filter(m => !blockedIdSet.has(String(m.userId)));
  }, [allMembers, blockedMembers]);

  const [initialized, setInitialized] = useState(false);
  const [pinnedOrder, setPinnedOrder] = useState<string[]>([]);
  const [pinnedIdSet, setPinnedIdSet] = useState<Set<string>>(new Set());
  const [hasOrderChanged, setHasOrderChanged] = useState(false);

  // 서버 응답 도착 시 1회 초기화 — render-adjust 패턴 (RN 동일)
  if (serverPinnedMembers && !initialized) {
    setInitialized(true);
    const ids = serverPinnedMembers.map(m => String(m.userId));
    setPinnedOrder(ids);
    setPinnedIdSet(new Set(ids));
  }

  // 새로 체크한 항목 (관심멤버 섹션에는 미반영, 체크 상태만 유지)
  const [newSelectedIds, setNewSelectedIds] = useState<string[]>([]);
  const newSelectedIdSet = useMemo(() => new Set(newSelectedIds), [newSelectedIds]);

  // 체크박스 표시: 기존 고정멤버 + 새 선택 모두 체크됨으로 표시
  const isChecked = useCallback(
    (userId: string) => pinnedIdSet.has(userId) || newSelectedIdSet.has(userId),
    [pinnedIdSet, newSelectedIdSet],
  );

  const isPinned = useCallback((userId: string) => pinnedIdSet.has(userId), [pinnedIdSet]);

  // 관심멤버 섹션: pinnedOrder 기준 (순서 보장)
  const pinnedMembers = useMemo(() => {
    const memberMap = new Map(allMembers.map(m => [String(m.userId), m]));
    return pinnedOrder.map(id => memberMap.get(id)).filter((m): m is MemberItem => m !== undefined);
  }, [pinnedOrder, allMembers]);

  // 하단 전체멤버의 체크박스 토글 (새 선택만 관리)
  const toggleNewSelection = useCallback(
    (userId: string) => {
      if (pinnedIdSet.has(userId)) return;
      setNewSelectedIds(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
      );
    },
    [pinnedIdSet],
  );

  // 관심멤버 섹션에서 해제 (즉시 DELETE API 호출 + optimistic update)
  const removePinned = useCallback(
    async (userId: string) => {
      setPinnedOrder(prev => prev.filter(id => id !== userId));
      setPinnedIdSet(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

      try {
        await deleteMutation.mutateAsync([Number(userId)]);
      } catch (err) {
        // 실패 시 로컬 복구
        setPinnedOrder(prev => [...prev, userId]);
        setPinnedIdSet(prev => new Set([...prev, userId]));
        throw err;
      }
    },
    [deleteMutation],
  );

  // 관심멤버 드래그 리오더 — pinnedOrder만 변경, pinnedIdSet은 불변
  const reorderPinned = useCallback((data: MemberItem[]) => {
    setPinnedOrder(data.map(m => String(m.userId)));
    setHasOrderChanged(true);
  }, []);

  const deselectNewSelections = useCallback(() => {
    setNewSelectedIds([]);
  }, []);

  // 저장: 현재 고정멤버 + 새 선택을 합쳐서 PUT
  const save = useCallback(async () => {
    const mergedIds = [...pinnedOrder, ...newSelectedIds];
    await replaceMutation.mutateAsync(mergedIds.map(Number));

    // 멤버목록 화면 캐시 즉시 업데이트
    const memberMap = new Map(allMembers.map(m => [String(m.userId), m]));
    const merged = mergedIds
      .map(id => memberMap.get(id))
      .filter((m): m is MemberItem => m !== undefined);
    queryClient.setQueryData(PINNED_MEMBERS_KEY, merged);

    setPinnedOrder(mergedIds);
    setPinnedIdSet(new Set(mergedIds));
    setNewSelectedIds([]);
    setHasOrderChanged(false);
  }, [pinnedOrder, newSelectedIds, replaceMutation, allMembers, queryClient]);

  // 순서 변경 저장: 완료 버튼 시 호출 (순서 변경 시에만 PUT 전송)
  const saveOrder = useCallback(async () => {
    if (!hasOrderChanged) return;
    await replaceMutation.mutateAsync(pinnedOrder.map(Number));

    if (serverPinnedMembers) {
      const memberMap = new Map(serverPinnedMembers.map(m => [String(m.userId), m]));
      const reordered = pinnedOrder
        .map(id => memberMap.get(id))
        .filter((m): m is MemberItem => m !== undefined);
      queryClient.setQueryData(PINNED_MEMBERS_KEY, reordered);
    }

    setHasOrderChanged(false);
  }, [hasOrderChanged, pinnedOrder, replaceMutation, serverPinnedMembers, queryClient]);

  return {
    isLoading: isPinnedLoading,
    pinnedMembers,
    allMembers: selectableMembers,
    isChecked,
    isPinned,
    toggleNewSelection,
    removePinned,
    reorderPinned,
    hasOrderChanged,
    saveOrder,
    deselectNewSelections,
    save,
    isSaving: replaceMutation.isPending || deleteMutation.isPending,
    pinnedCount: pinnedOrder.length,
    totalCount: selectableMembers.length,
    newSelectionCount: newSelectedIds.length,
    hasNewSelections: newSelectedIds.length > 0,
  };
}

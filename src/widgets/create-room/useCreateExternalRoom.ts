'use client';

import { comparePolicyMemberName } from '@/features/members/policySort';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { roomPath } from '@/shared/hooks/useRoomIdParam';
import { useGetMembers } from '@/features/members/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { useCheckDuplicateEM } from '@/features/external-chat/queries';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import type { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

export type CreateExternalTab = 'external' | 'company';

const MAX_TITLE = 50;

/**
 * 새 협력채팅(EM) 생성 컨트롤러.
 * Step1: 협력멤버/사내멤버 2탭 멀티선택(탭 간 선택 유지) →
 *   중복방 검사(/app/em/rooms/check-duplicate) → Step2: 방 제목(1~50) → 첫 전송 시 생성.
 * (RN CreateExternalRoom 플로우 패리티 — 2026-08-18 협력멤버 최소 1명 데스크톱 규칙 제거, 앱 기준 통일)
 */
export function useCreateExternalRoom(onClose: () => void) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore(s => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();
  const { mutateAsync: checkDuplicate, isPending: isChecking } = useCheckDuplicateEM();

  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<CreateExternalTab>('external');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitleRaw] = useState('');
  // 중복방 검사 결과 — 같은 멤버 조합의 기존 방 id (있으면 안내 다이얼로그 표시)
  const [duplicateRoomId, setDuplicateRoomId] = useState<string | null>(null);

  const setTitle = (v: string) => setTitleRaw(v.slice(0, MAX_TITLE));

  // 차단 멤버는 대화상대 선택에서 제외 (정책 block.md)
  const blockedItems = useBlockedMembersStore(s => s.items);
  const blockedIdSet = useMemo(
    () => new Set(blockedItems.map(m => String(m.userId))),
    [blockedItems],
  );

  const notMe = useCallback(
    (m: MemberItem) => String(m.userId) !== String(myUserId) && !blockedIdSet.has(String(m.userId)),
    [myUserId, blockedIdSet],
  );

  const externalMembers = useMemo(() => members.filter(m => m.isExternal === true && notMe(m)), [members, notMe]);
  const companyMembers = useMemo(() => members.filter(m => m.isExternal !== true && notMe(m)), [members, notMe]);
  const pinnedExternal = useMemo(() => pinnedMembers.filter(m => m.isExternal === true && notMe(m)), [pinnedMembers, notMe]);
  const pinnedCompany = useMemo(() => pinnedMembers.filter(m => m.isExternal !== true && notMe(m)), [pinnedMembers, notMe]);

  // 현재 탭의 소스
  const tabMembers = activeTab === 'external' ? externalMembers : companyMembers;
  const tabPinned = activeTab === 'external' ? pinnedExternal : pinnedCompany;

  const pinnedSection = useMemo(() => filterByhangeulSearch(tabPinned, search, m => m.name), [tabPinned, search]);
  // 정책 정렬 (RN CreateExternalRoomStep1 패리티) — 관심멤버 섹션은 사용자 지정 순서 유지
  const memberSection = useMemo(() => [...filterByhangeulSearch(tabMembers, search, m => m.name)].sort((a, b) => comparePolicyMemberName(a.name, b.name)), [tabMembers, search]);

  const hasAnyMember = tabMembers.length > 0 || tabPinned.length > 0;

  // 선택 멤버 조회용 전체 풀(양 탭 합침, userId 중복 제거)
  const allMembers = useMemo(() => {
    const map = new Map<string, MemberItem>();
    [...externalMembers, ...companyMembers].forEach(m => map.set(String(m.userId), m));
    return map;
  }, [externalMembers, companyMembers]);

  const selectedMembers = useMemo(
    () => [...selectedIds].map(id => allMembers.get(id)).filter((m): m is MemberItem => !!m),
    [selectedIds, allMembers],
  );
  const hasExternalSelected = selectedMembers.some(m => m.isExternal === true);
  const namePlaceholder = useMemo(() => selectedMembers.map(m => m.name).join(','), [selectedMembers]);

  const count = selectedIds.size;
  const isMember = (m: MemberItem) => selectedIds.has(String(m.userId));

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const removeSelected = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const reset = useCallback(() => {
    setStep(1);
    setActiveTab('external');
    setSearch('');
    setSelectedIds(new Set());
    setTitleRaw('');
    setDuplicateRoomId(null);
  }, []);
  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // 탭 전환 시 검색어 유지 (RN 단일 useSearch 패리티 — 초기화하지 않는다)
  const changeTab = (tab: CreateExternalTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  // 협력방 입장(기존 방/신규 방 공통) — 캐시에서 방 정보를 찾아 채워 입장
  const enterRoom = useCallback(
    (room: { roomId: string; title: string; participants: { userId: string; name: string }[]; notReadCount?: number; lastMessage?: GetChatRoomListItemType['messageList'][number] | null }) => {
      const others = room.participants.filter(p => String(p.userId) !== String(myUserId));
      useChatRoomInfo.getState().setChatRoomInfo({
        roomId: room.roomId,
        roomName: room.title || others.map(p => p.name).join(', ') || '채팅방',
        channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
        totalUserCount: room.participants.length || others.length + 1,
        otherUserIsExit: others.length === 0,
        otherUserIsRemoved: false,
        lastMessage: room.lastMessage ?? null,
        initialNotReadCount: room.notReadCount ?? 0,
      });
      close();
      router.push(roomPath('/external-chat', room.roomId));
    },
    [close, router, myUserId],
  );

  const goToExistingRoom = (roomId: string) => {
    const cached = queryClient.getQueryData<GetChatRoomListItemType[]>(EM_ROOM_LIST_KEY) ?? [];
    const found = cached.find(r => r.roomModel.roomId === roomId);
    if (found) {
      enterRoom({
        roomId,
        title: found.roomModel.title,
        participants: found.roomModel.participants ?? [],
        notReadCount: found.notReadCount,
        lastMessage: found.messageList[0] ?? null,
      });
    } else {
      close();
      router.push(roomPath('/external-chat', roomId));
    }
  };

  // RN 패리티: 1명 이상 선택이면 확인 가능 (협력멤버 필수 규칙 없음)
  const canConfirmStep1 = count >= 1;
  const canConfirmStep2 = title.trim().length > 0;

  // Step1 확인: 중복 검사 → 기존방 이동/새 방(Step2) 분기 (RN 패리티)
  const handleStep1Confirm = async () => {
    if (count === 0 || isChecking) return;
    try {
      const res = await checkDuplicate([...selectedIds, String(myUserId)].filter(Boolean));
      const { exists, roomIds } = res.payload;
      if (exists && roomIds[0]) {
        // 중복방 안내 다이얼로그 표시 (새 방 만들기 / 기존 방 이동 분기)
        setDuplicateRoomId(roomIds[0]);
        return;
      }
      setStep(2);
    } catch {
      // 검사 실패는 서버가 생성 시 재검증하므로 안내 후 진행 (RN §7-C-6 정책 + 스낵바 패리티)
      useUIStore.getState().showSnackbar({ message: '잠시 후 다시 시도해주세요.', state: 'error' });
      setStep(2);
    }
  };

  // 중복방 안내: "새로운 채팅방 만들기" → 무시하고 Step2 / "기존 채팅방으로 이동" → 기존 방 입장
  const confirmCreateNew = () => {
    setDuplicateRoomId(null);
    setStep(2);
  };
  const confirmGoExisting = () => {
    if (duplicateRoomId) goToExistingRoom(duplicateRoomId);
  };
  const closeDuplicate = () => setDuplicateRoomId(null);

  // 방을 즉시 만들지 않고 draft로 진입 — 첫 메시지 전송 시 POST /app/em (RN 패리티, 취소 시 빈 방 잔존 방지)
  const handleStep2Confirm = () => {
    if (!canConfirmStep2) return;
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: '',
      roomName: title.trim(),
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: selectedIds.size + 1,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      invitedUserIds: [...selectedIds],
      lastMessage: null,
      initialNotReadCount: 0,
    });
    useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    close();
    router.push('/external-chat/new');
  };

  const goBack = () => setStep(1);

  return {
    step,
    goBack,
    activeTab,
    changeTab,
    search,
    setSearch,
    selectedIds,
    toggleSelect,
    removeSelected,
    isMember,
    selectedMembers,
    namePlaceholder,
    hasExternalSelected,
    title,
    setTitle,
    maxTitle: MAX_TITLE,
    pinnedSection,
    memberSection,
    hasAnyMember,
    isLoading,
    isChecking,
    count,
    canConfirmStep1,
    canConfirmStep2,
    handleStep1Confirm,
    handleStep2Confirm,
    duplicateRoomId,
    confirmCreateNew,
    confirmGoExisting,
    closeDuplicate,
    close,
  };
}

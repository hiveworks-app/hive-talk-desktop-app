'use client';

import { comparePolicyMemberName } from '@/features/members/policySort';
import { useCallback, useMemo, useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMembers } from '@/features/members/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import type { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useUIStore } from '@/store';
import { apiGetDmCheck } from '@/features/chat-room-list/api';
import type { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { findExistingDMRoom } from './createRoomUtils';

const MAX_TITLE = 50;

/**
 * 새 채팅방 생성 컨트롤러.
 * 인원수로 자동 판별 — 1명=1:1(DM, 바로 생성), 2명 이상=그룹(GM, Step2 채팅방 정보 설정).
 * 방은 첫 메시지 전송 시 channelType에 맞는 엔드포인트(POST /app/dm/{userId} | /app/gm)로 생성된다.
 * (RN CreateChatRoomScreen 2-step 패리티)
 */
export function useCreateRoom(onClose: () => void, presetMemberIds?: string[]) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore((state) => state.showSnackbar);
  const myUserId = useAuthStore((s) => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  // presetMemberIds: DM 대화초대 → 기존 상대를 포함한 신규 GM 생성 진입 (RN 패리티)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(presetMemberIds ?? []));
  const [gmTitle, setGmTitleRaw] = useState('');

  const setGmTitle = (v: string) => setGmTitleRaw(v.slice(0, MAX_TITLE));

  // 차단 멤버는 대화상대 선택에서 제외 (정책 block.md)
  const blockedItems = useBlockedMembersStore(s => s.items);
  const blockedIdSet = useMemo(
    () => new Set(blockedItems.map((m) => String(m.userId))),
    [blockedItems],
  );

  // 사내멤버(협력 제외, 나 제외, 차단 제외)만 대화상대로
  const companyMembers = useMemo(
    () => members.filter((m) => m.isExternal !== true && String(m.userId) !== String(myUserId) && !blockedIdSet.has(String(m.userId))),
    [members, myUserId, blockedIdSet],
  );
  // 관심멤버도 협력멤버(isExternal)는 제외 — 사내채팅(DM/GM) 생성 대상이 아니므로 (RN CreateChatRoomStep1 패리티)
  const pinnedCompany = useMemo(
    () => pinnedMembers.filter((m) => m.isExternal !== true && String(m.userId) !== String(myUserId) && !blockedIdSet.has(String(m.userId))),
    [pinnedMembers, myUserId, blockedIdSet],
  );

  const pinnedSection = useMemo(
    () => filterByhangeulSearch(pinnedCompany, search, (m) => m.name),
    [pinnedCompany, search],
  );
  const companySection = useMemo(
    // 정책 정렬 (RN CreateChatRoomStep1 패리티) — 관심멤버 섹션은 사용자 지정 순서 유지
    () => [...filterByhangeulSearch(companyMembers, search, (m) => m.name)].sort((a, b) => comparePolicyMemberName(a.name, b.name)),
    [companyMembers, search],
  );

  const hasAnyMember = companyMembers.length > 0;
  const count = selectedIds.size;

  // 선택된 멤버 (선택 순서 유지) — 스트립/아바타그리드/제목 placeholder용
  const selectedMembers = useMemo(
    () =>
      [...selectedIds]
        .map((id) => companyMembers.find((m) => String(m.userId) === id))
        .filter((m): m is MemberItem => !!m),
    [selectedIds, companyMembers],
  );
  const namePlaceholder = useMemo(() => selectedMembers.map((m) => m.name).join(','), [selectedMembers]);

  const isMember = (m: MemberItem) => selectedIds.has(String(m.userId));

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const removeSelected = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const reset = useCallback(() => {
    setStep(1);
    setSearch('');
    setSelectedIds(new Set());
    setGmTitleRaw('');
  }, []);
  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const navigateToRoom = useCallback(
    (
      roomId: string,
      roomName: string,
      channelType: typeof WS_CHANNEL_TYPE.DIRECT_MESSAGE | typeof WS_CHANNEL_TYPE.GROUP_MESSAGE,
      totalUserCount: number,
      lastMessage: WebSocketPublishItem | null = null,
      invitedUserIds: string[] = [],
    ) => {
      useChatRoomInfo.getState().setChatRoomInfo({
        roomId, roomName, channelType, totalUserCount, otherUserIsExit: false, otherUserIsRemoved: false, invitedUserIds, lastMessage,
      });
      if (!roomId) {
        useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
      }
      close();
      router.push(roomId ? `/chat/${roomId}` : '/chat/new');
    },
    [close, router],
  );

  // 1:1 (DM) — dedup 순서: ① 목록 캐시 ② 서버 dm-check(내가 나갔던 방 복귀 포함) ③ 신규 draft
  // (RN moveToDMRoom 3단 dedup 패리티 — 방은 첫 메시지 시 POST /app/dm/{userId}로 생성)
  const submitDM = async () => {
    const userId = [...selectedIds][0];
    const member = companyMembers.find((m) => String(m.userId) === userId);

    const openExisting = (room: GetChatRoomListItemType) => {
      const otherIsExit = room.roomModel.participantDetail?.isExit === true;
      navigateToRoom(
        room.roomModel.roomId,
        room.roomModel.participantDetail?.name ?? member?.name ?? '채팅방',
        WS_CHANNEL_TYPE.DIRECT_MESSAGE,
        room.roomModel.participants?.length ?? 2,
        room.messageList[0] ?? null,
        // 상대가 나간 방이면 메시지 전송 시 자동 재초대 준비 (목록 행 클릭과 동일)
        otherIsExit ? [userId] : [],
      );
      showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
    };

    const cached = findExistingDMRoom(queryClient, userId);
    if (cached) {
      openExisting(cached);
      return;
    }

    // 캐시에 없으면 서버 조회 — 실패 시 신규 draft로 진행 (RN과 동일한 관용 처리)
    try {
      const res = await apiGetDmCheck(userId);
      if (res.payload?.roomModel?.roomId) {
        openExisting(res.payload);
        return;
      }
    } catch {
      // 조회 실패 — 신규 방 생성(draft)으로 진행
    }
    navigateToRoom('', member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2, null, [userId]);
  };

  // 그룹(GM) — 신규(첫 메시지 시 POST /app/gm { title, userIdList })
  const submitGM = () => {
    navigateToRoom('', gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, count + 1, null, [...selectedIds]);
  };

  const canConfirmStep1 = count >= 1;
  const canConfirmStep2 = count >= 2 && gmTitle.trim().length > 0;

  // Step1 확인: 1명=DM 바로 생성, 2명+=Step2(채팅방 정보 설정)로
  const handleStep1Confirm = () => {
    if (count === 0) return;
    if (count === 1) void submitDM();
    else setStep(2);
  };
  const handleStep2Confirm = () => {
    if (!canConfirmStep2) return;
    submitGM();
  };
  // Step2 X → Step1 복귀 + 입력한 방 이름 초기화 (RN 패리티)
  const goBack = () => {
    setGmTitleRaw('');
    setStep(1);
  };

  return {
    step, goBack,
    search, setSearch,
    selectedIds, toggleSelect, removeSelected, isMember,
    selectedMembers, namePlaceholder,
    gmTitle, setGmTitle, maxTitle: MAX_TITLE,
    pinnedSection, companySection,
    hasAnyMember, isLoading,
    count,
    canConfirmStep1, canConfirmStep2,
    handleStep1Confirm, handleStep2Confirm,
    close,
  };
}

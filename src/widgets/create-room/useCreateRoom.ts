'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMembers } from '@/features/members/queries';
import { useGetPinnedMembers } from '@/features/pinned-members/queries';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import type { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useUIStore } from '@/store';
import { findExistingDMRoom } from './createRoomUtils';

const MAX_TITLE = 50;

/**
 * 새 채팅방 생성 컨트롤러.
 * 인원수로 자동 판별 — 1명=1:1(DM, 바로 생성), 2명 이상=그룹(GM, Step2 채팅방 정보 설정).
 * 방은 첫 메시지 전송 시 channelType에 맞는 엔드포인트(POST /app/dm/{userId} | /app/gm)로 생성된다.
 * (RN CreateChatRoomScreen 2-step 패리티)
 */
export function useCreateRoom(onClose: () => void) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore((state) => state.showSnackbar);
  const myUserId = useAuthStore((s) => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gmTitle, setGmTitleRaw] = useState('');

  const setGmTitle = (v: string) => setGmTitleRaw(v.slice(0, MAX_TITLE));

  // 사내멤버(협력 제외, 나 제외)만 대화상대로
  const companyMembers = useMemo(
    () => members.filter((m) => m.isExternal !== true && String(m.userId) !== String(myUserId)),
    [members, myUserId],
  );
  // 관심멤버도 협력멤버(isExternal)는 제외 — 사내채팅(DM/GM) 생성 대상이 아니므로 (RN CreateChatRoomStep1 패리티)
  const pinnedCompany = useMemo(
    () => pinnedMembers.filter((m) => m.isExternal !== true && String(m.userId) !== String(myUserId)),
    [pinnedMembers, myUserId],
  );

  const pinnedSection = useMemo(
    () => filterByhangeulSearch(pinnedCompany, search, (m) => m.name),
    [pinnedCompany, search],
  );
  const companySection = useMemo(
    () => filterByhangeulSearch(companyMembers, search, (m) => m.name),
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
        roomId, roomName, channelType, totalUserCount, otherUserIsExit: false, invitedUserIds, lastMessage,
      });
      if (!roomId) {
        useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
      }
      close();
      router.push(roomId ? `/chat/${roomId}` : '/chat/new');
    },
    [close, router],
  );

  // 1:1 (DM) — 기존 방 있으면 이동, 없으면 신규(첫 메시지 시 POST /app/dm/{userId})
  const submitDM = () => {
    const userId = [...selectedIds][0];
    const member = companyMembers.find((m) => String(m.userId) === userId);
    const existing = findExistingDMRoom(queryClient, userId);
    if (existing) {
      navigateToRoom(
        existing.roomModel.roomId,
        existing.roomModel.participantDetail?.name ?? member?.name ?? '채팅방',
        WS_CHANNEL_TYPE.DIRECT_MESSAGE,
        existing.roomModel.participants?.length ?? 2,
        existing.messageList[0] ?? null,
      );
      showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
      return;
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
    if (count === 1) submitDM();
    else setStep(2);
  };
  const handleStep2Confirm = () => {
    if (!canConfirmStep2) return;
    submitGM();
  };
  const goBack = () => setStep(1);

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

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

/**
 * 새 채팅방 생성 컨트롤러.
 * 모드 토글 없이 **선택 인원수로 자동 판별** — 1명=1:1(DM), 2명 이상=그룹(GM).
 * 방은 첫 메시지 전송 시 channelType에 맞는 엔드포인트(POST /app/dm/{userId} | /app/gm)로 생성된다.
 * (RN CreateChatRoomScreen 패리티)
 */
export function useCreateRoom(onClose: () => void) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore((state) => state.showSnackbar);
  const myUserId = useAuthStore((s) => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();
  const { data: pinnedMembers = [] } = useGetPinnedMembers();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gmTitle, setGmTitle] = useState('');

  // 사내멤버(협력 제외, 나 제외)만 대화상대로
  const companyMembers = useMemo(
    () => members.filter((m) => m.isExternal !== true && String(m.userId) !== String(myUserId)),
    [members, myUserId],
  );
  // 관심멤버 섹션 — 등록 순서 유지, 나 제외
  const pinnedCompany = useMemo(
    () => pinnedMembers.filter((m) => String(m.userId) !== String(myUserId)),
    [pinnedMembers, myUserId],
  );

  // 이름 부분일치 + 한글 초성 검색 (멤버목록 검색과 동일)
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
  // 2명 이상이면 그룹 → 방 제목 필요
  const needsTitle = count >= 2;
  const canSubmit = count === 1 || (count >= 2 && gmTitle.trim().length > 0);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const reset = useCallback(() => {
    setSearch('');
    setSelectedIds(new Set());
    setGmTitle('');
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

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (count === 1) {
      // 1:1 (DM) — 기존 방 있으면 이동, 없으면 신규(첫 메시지 시 POST /app/dm/{userId})
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
    } else {
      // 그룹(GM) — 신규(첫 메시지 시 POST /app/gm { title, userIdList })
      navigateToRoom('', gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, count + 1, null, [...selectedIds]);
    }
  };

  return {
    search, setSearch,
    selectedIds, toggleSelect,
    gmTitle, setGmTitle,
    pinnedSection, companySection,
    companyTotal: companyMembers.length,
    hasAnyMember,
    isLoading,
    count, needsTitle, canSubmit,
    handleSubmit,
    close,
    isMember: (m: MemberItem) => selectedIds.has(String(m.userId)),
  };
}

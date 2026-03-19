'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMembers } from '@/features/members/queries';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useUIStore } from '@/store';
import { findExistingDMRoom } from './createRoomUtils';

type Mode = 'dm' | 'gm';

export function useCreateRoom(onClose: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(state => state.showSnackbar);
  const myUserId = useAuthStore(s => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();

  const [mode, setMode] = useState<Mode>('dm');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gmTitle, setGmTitle] = useState('');

  const otherMembers = useMemo(() => members.filter(m => m.userId !== myUserId), [members, myUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherMembers;
    return otherMembers.filter(
      m => m.name.toLowerCase().includes(q) || m.department?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    );
  }, [otherMembers, search]);

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (mode === 'dm') {
        if (next.has(userId)) next.delete(userId);
        else { next.clear(); next.add(userId); }
      } else {
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
      }
      return next;
    });
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedIds(new Set());
    setGmTitle('');
  };

  const canSubmit = mode === 'dm' ? selectedIds.size === 1 : selectedIds.size >= 2 && gmTitle.trim().length > 0;

  const navigateToRoom = useCallback((
    roomId: string, roomName: string,
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
    onClose();
    router.push(roomId ? `/chat/${roomId}` : '/chat/new');
  }, [onClose, router]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (mode === 'dm') {
      const userId = [...selectedIds][0];
      const member = otherMembers.find(m => m.userId === userId);

      // 캐시에서 기존 방 확인
      const existingRoom = findExistingDMRoom(queryClient, userId);
      if (existingRoom) {
        navigateToRoom(
          existingRoom.roomModel.roomId,
          existingRoom.roomModel.participantDetail?.name || existingRoom.roomModel.participants?.find(p => String(p.userId) === String(userId))?.name || member?.name || '채팅방',
          WS_CHANNEL_TYPE.DIRECT_MESSAGE,
          existingRoom.roomModel.participants?.length ?? 2,
          existingRoom.messageList[0] ?? null,
        );
        showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
        return;
      }

      // 기존 방 없음 → roomId 없이 채팅방 진입 (메시지 전송 시 생성)
      navigateToRoom('', member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2, null, [userId]);
    } else {
      // GM → roomId 없이 채팅방 진입 (메시지 전송 시 생성)
      navigateToRoom('', gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, selectedIds.size + 1, null, [...selectedIds]);
    }
  };

  return {
    mode, handleModeChange,
    search, setSearch,
    selectedIds, toggleSelect,
    gmTitle, setGmTitle,
    otherMembers, filtered,
    isLoading, isPending: false,
    canSubmit, handleSubmit,
  };
}

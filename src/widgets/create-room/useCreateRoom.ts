'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDM, useCreateGM } from '@/features/create-chat-room/queries';
import { useGetMembers } from '@/features/members/queries';
import { isApiError } from '@/shared/api';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store';
import { findExistingDMRoom, extractRoomIdFromError } from './createRoomUtils';

type Mode = 'dm' | 'gm';

export function useCreateRoom(onClose: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(state => state.showSnackbar);
  const myUserId = useAuthStore(s => s.user?.id);
  const { data: members = [], isLoading } = useGetMembers();
  const { mutateAsync: createDM, isPending: dmPending } = useCreateDM();
  const { mutateAsync: createGM, isPending: gmPending } = useCreateGM();

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

  const isPending = dmPending || gmPending;

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
    onClose();
    router.push(`/chat/${roomId}`);
  }, [onClose, router]);

  const handleSubmit = async () => {
    if (!canSubmit || isPending) return;

    if (mode === 'dm') {
      const userId = [...selectedIds][0];
      const member = otherMembers.find(m => m.userId === userId);

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

      try {
        const res = await createDM(userId);
        navigateToRoom(res.payload.roomId, member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2, null, [userId]);
      } catch (err) {
        if (!isApiError(err)) { showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' }); return; }
        const existingRoomId = extractRoomIdFromError(err);
        if (existingRoomId) {
          navigateToRoom(existingRoomId, member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2);
          showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
        const refetchedRoom = findExistingDMRoom(queryClient, userId);
        if (refetchedRoom) {
          navigateToRoom(
            refetchedRoom.roomModel.roomId,
            refetchedRoom.roomModel.participantDetail?.name || member?.name || '채팅방',
            WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2, refetchedRoom.messageList[0] ?? null,
          );
          showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
          return;
        }
        showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
      }
    } else {
      const res = await createGM({ title: gmTitle.trim(), userIdList: [...selectedIds] });
      navigateToRoom(res.payload.roomId, gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, selectedIds.size + 1, null, [...selectedIds]);
    }
  };

  return {
    mode, handleModeChange,
    search, setSearch,
    selectedIds, toggleSelect,
    gmTitle, setGmTitle,
    otherMembers, filtered,
    isLoading, isPending,
    canSubmit, handleSubmit,
  };
}

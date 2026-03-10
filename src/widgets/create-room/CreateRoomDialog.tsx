'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDM, useCreateGM } from '@/features/create-chat-room/queries';
import { useGetMembers } from '@/features/members/queries';
import { isApiError } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store';
import { MemberRow } from './MemberRow';
import { findExistingDMRoom, extractRoomIdFromError } from './createRoomUtils';

type Mode = 'dm' | 'gm';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ isOpen, onClose }: CreateRoomDialogProps) {
  useDimmed(isOpen);
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

  const otherMembers = useMemo(
    () => members.filter(m => m.userId !== myUserId),
    [members, myUserId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherMembers;
    return otherMembers.filter(
      m =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    );
  }, [otherMembers, search]);

  const isPending = dmPending || gmPending;

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (mode === 'dm') {
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.clear();
          next.add(userId);
        }
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

  const canSubmit =
    mode === 'dm'
      ? selectedIds.size === 1
      : selectedIds.size >= 2 && gmTitle.trim().length > 0;

  const navigateToRoom = (
    roomId: string,
    roomName: string,
    channelType: typeof WS_CHANNEL_TYPE.DIRECT_MESSAGE | typeof WS_CHANNEL_TYPE.GROUP_MESSAGE,
    totalUserCount: number,
    lastMessage: WebSocketPublishItem | null = null,
    invitedUserIds: string[] = [],
  ) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName,
      channelType,
      totalUserCount,
      otherUserIsExit: false,
      invitedUserIds,
      lastMessage,
    });
    onClose();
    router.push(`/chat/${roomId}`);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isPending) return;

    if (mode === 'dm') {
      const userId = [...selectedIds][0];
      const member = otherMembers.find(m => m.userId === userId);

      const existingRoom = findExistingDMRoom(queryClient, userId);
      if (existingRoom) {
        navigateToRoom(
          existingRoom.roomModel.roomId,
          existingRoom.roomModel.participantDetail?.name
            || existingRoom.roomModel.participants?.find(p => String(p.userId) === String(userId))?.name
            || member?.name || '채팅방',
          WS_CHANNEL_TYPE.DIRECT_MESSAGE,
          existingRoom.roomModel.participants?.length ?? 2,
          existingRoom.messageList[0] ?? null,
        );
        showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
        return;
      }

      try {
        const res = await createDM(userId);
        const { roomId } = res.payload;

        navigateToRoom(roomId, member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2, null, [userId]);
      } catch (err) {
        if (!isApiError(err)) {
          showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
          return;
        }

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
            WS_CHANNEL_TYPE.DIRECT_MESSAGE,
            2,
            refetchedRoom.messageList[0] ?? null,
          );
          showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
          return;
        }

        showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
      }
    } else {
      const res = await createGM({
        title: gmTitle.trim(),
        userIdList: [...selectedIds],
      });
      const { roomId } = res.payload;

      navigateToRoom(roomId, gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, selectedIds.size + 1, null, [...selectedIds]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 다이얼로그 */}
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-[440px] flex-col rounded-xl bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-heading-sm font-bold text-text-primary">새 채팅방</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모드 탭 */}
        <div className="flex border-b border-divider">
          <button
            onClick={() => handleModeChange('dm')}
            className={cn(
              'flex-1 py-2.5 text-sub font-medium transition-colors',
              mode === 'dm'
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            1:1 채팅
          </button>
          <button
            onClick={() => handleModeChange('gm')}
            className={cn(
              'flex-1 py-2.5 text-sub font-medium transition-colors',
              mode === 'gm'
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            그룹 채팅
          </button>
        </div>

        {/* GM 제목 */}
        {mode === 'gm' && (
          <div className="border-b border-divider px-5 py-3">
            <input
              type="text"
              value={gmTitle}
              onChange={e => setGmTitle(e.target.value)}
              placeholder="그룹 채팅방 이름"
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
            />
          </div>
        )}

        {/* 선택된 멤버 칩 */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-divider px-5 py-2.5">
            {[...selectedIds].map(id => {
              const m = otherMembers.find(m => m.userId === id);
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-state-primary-highlighted px-2.5 py-1 text-sub-sm text-primary"
                >
                  {m?.name ?? id}
                  <button onClick={() => toggleSelect(id)} className="hover:text-red-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* 검색 */}
        <div className="px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서, 이메일로 검색"
            className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sub text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
          />
        </div>

        {/* 멤버 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="py-8 text-center text-sub text-text-tertiary">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sub text-text-tertiary">멤버가 없습니다</div>
          ) : (
            filtered.map(member => (
              <MemberRow
                key={member.userId}
                member={member}
                selected={selectedIds.has(member.userId)}
                onToggle={() => toggleSelect(member.userId)}
              />
            ))
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-divider px-5 py-3">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sub font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled disabled:text-text-placeholder"
          >
            {isPending
              ? '생성 중...'
              : mode === 'dm'
                ? '1:1 채팅 시작'
                : `그룹 채팅 시작 (${selectedIds.size}명)`}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDM, useCreateGM } from '@/features/create-chat-room/queries';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useGetMembers } from '@/features/members/queries';
import { isApiError } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { DM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE, WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store';

type Mode = 'dm' | 'gm';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ isOpen, onClose }: CreateRoomDialogProps) {
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
        // DM: 단일 선택
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.clear();
          next.add(userId);
        }
      } else {
        // GM: 복수 선택
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
  ) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName,
      channelType,
      totalUserCount,
      otherUserIsExit: false,
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

      // 이미 존재하는 DM 방이면 API 호출 없이 바로 이동
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
        navigateToRoom(roomId, member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2);
      } catch (err) {
        if (!isApiError(err)) {
          showSnackbar({ message: '채팅방 생성에 실패했습니다.', state: 'error' });
          return;
        }

        console.log('[CreateRoom] DM 생성 에러:', { code: err.code, message: err.message, payload: err.payload, rawBody: err.rawBody });

        // 에러 응답에서 roomId 추출 시도
        const existingRoomId = extractRoomIdFromError(err);
        if (existingRoomId) {
          navigateToRoom(existingRoomId, member?.name ?? '채팅방', WS_CHANNEL_TYPE.DIRECT_MESSAGE, 2);
          showSnackbar({ message: '기존 채팅방으로 이동합니다.', state: 'info' });
          return;
        }

        // DM 목록을 새로 조회 후 재검색
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
      navigateToRoom(roomId, gmTitle.trim(), WS_CHANNEL_TYPE.GROUP_MESSAGE, selectedIds.size + 1);
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
          <h2 className="text-base font-bold text-text-primary">새 채팅방</h2>
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
              'flex-1 py-2.5 text-sm font-medium transition-colors',
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
              'flex-1 py-2.5 text-sm font-medium transition-colors',
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
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
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
                  className="flex items-center gap-1 rounded-full bg-state-primary-highlighted px-2.5 py-1 text-xs text-primary"
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
            className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-placeholder focus:border-primary"
          />
        </div>

        {/* 멤버 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-tertiary">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-tertiary">멤버가 없습니다</div>
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
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-[var(--color-state-primary-pressed)] disabled:bg-disabled disabled:text-text-placeholder"
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

function MemberRow({
  member,
  selected,
  onToggle,
}: {
  member: MemberItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-state-primary-highlighted' : 'hover:bg-surface-pressed',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-text-secondary">
        {member.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{member.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          {member.department && <span>{member.department}</span>}
          {member.job && <span>{member.job}</span>}
        </div>
      </div>
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-primary bg-primary' : 'border-gray-300',
        )}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}

function findExistingDMRoom(
  queryClient: ReturnType<typeof useQueryClient>,
  targetUserId: string,
): GetChatRoomListItemType | undefined {
  const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
  return dmRooms.find(room => {
    const uid = String(targetUserId);
    // participantDetail (1:1 상대방 정보)
    if (String(room.roomModel.participantDetail?.userId) === uid) return true;
    // participants 배열에서 검색
    return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
  });
}

function extractRoomIdFromError(err: { payload?: unknown; rawBody?: string }): string | null {
  // 1. err.payload.payload.roomId (ApiResponse 구조)
  const body = err.payload as Record<string, unknown> | null;
  if (body?.payload && typeof body.payload === 'object') {
    const inner = body.payload as Record<string, unknown>;
    if (typeof inner.roomId === 'string') return inner.roomId;
  }

  // 2. err.payload.roomId (flat 구조)
  if (body && typeof body.roomId === 'string') return body.roomId;

  // 3. rawBody에서 roomId JSON 파싱 시도
  if (err.rawBody) {
    try {
      const parsed = JSON.parse(err.rawBody);
      const roomId = parsed?.payload?.roomId ?? parsed?.roomId;
      if (typeof roomId === 'string') return roomId;
    } catch { /* ignore */ }
  }

  return null;
}

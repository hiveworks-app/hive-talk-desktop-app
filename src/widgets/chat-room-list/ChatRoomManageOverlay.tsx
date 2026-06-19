'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { isOffline } from '@/shared/utils/offlineGuard';
import { Checkbox } from '@/shared/ui/Checkbox';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GroupProfileAvatar, type GroupAvatarUser } from '@/shared/ui/GroupProfileAvatar';
import IconLeave from '@assets/icons/leave.svg';

export interface ManageRoomEntry {
  roomId: string;
  displayName: string;
  avatarUsers: GroupAvatarUser[];
  preview: string;
}

interface ChatRoomManageOverlayProps {
  open: boolean;
  onClose: () => void;
  rooms: ManageRoomEntry[];
  /** 선택한 방들을 실제로 나가는 처리(WS EXIT + 캐시 제거 + 라우팅). confirm/close는 오버레이가 담당. */
  onLeave: (roomIds: string[]) => void;
  /** confirm에 덧붙일 안내 줄 (예: 협력채팅 "나가면 다시 초대받아야 입장할 수 있어요."). */
  leaveNotice?: string;
}

/**
 * 채팅방 관리(복수 선택 나가기) 공용 풀스크린 모달.
 * fixed inset-0 z-50으로 좌측 AppNav까지 덮어 사이드 탭을 가린다 (Figma 1696-53393 / 1010-10399).
 * 선택상태·confirm·UI는 오버레이가, 데이터(rooms)·나가기 로직(onLeave)은 EM/사내 래퍼가 주입한다.
 */
export function ChatRoomManageOverlay({ open, onClose, rooms, onLeave, leaveNotice }: ChatRoomManageOverlayProps) {
  useDimmed(open);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!open) return null;

  const count = selectedIds.size;

  const toggle = (roomId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const close = () => {
    clearSelection();
    onClose();
  };

  const handleLeave = () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || isOffline()) return;
    const notice = leaveNotice ? `\n${leaveNotice}` : '';
    if (!window.confirm(`${ids.length}개의 채팅방을 나가겠어요?${notice}`)) return;
    onLeave(ids);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* macOS 신호등 영역 확보용 드래그 바 */}
      <div className="electron-drag h-8 w-full shrink-0" />

      {/* 헤더: 완료 / 채팅방 관리 / N 선택해제 */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <button onClick={close} className="text-sub font-medium text-text-primary hover:opacity-80">
          완료
        </button>
        <h2 className="text-heading-md font-semibold text-text-primary">채팅방 관리</h2>
        <button
          onClick={clearSelection}
          disabled={count === 0}
          className={cn(
            'text-sub font-semibold transition-colors',
            count > 0 ? 'text-text-primary hover:opacity-80' : 'cursor-default text-text-tertiary',
          )}
        >
          {count > 0 ? `${count} 선택해제` : '선택해제'}
        </button>
      </div>

      {/* 목록 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <EmptyState message="관리할 채팅방이 없어요." className="py-10" />
        ) : (
          rooms.map(room => {
            const selected = selectedIds.has(room.roomId);
            return (
              <button
                key={room.roomId}
                onClick={() => toggle(room.roomId)}
                className={cn(
                  'flex w-full items-center gap-3.5 px-4 py-2 text-left transition-colors',
                  selected ? 'bg-blue-100' : 'hover:bg-gray-50',
                )}
              >
                <Checkbox checked={selected} size="lg" className="shrink-0" />
                <GroupProfileAvatar users={room.avatarUsers} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sub font-medium text-text-primary">{room.displayName}</span>
                  <span className="block truncate text-sub-sm text-text-secondary">{room.preview}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 하단 CTA: 채팅방 나가기 */}
      <div className="border-t border-divider px-4 py-3">
        <button
          onClick={handleLeave}
          disabled={count === 0}
          className={cn(
            'flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-base font-medium text-white transition-opacity',
            count > 0 ? 'bg-state-error hover:opacity-90' : 'cursor-default bg-gray-400',
          )}
        >
          <IconLeave width={20} height={20} />
          채팅방 나가기{count > 0 ? ` (${count})` : ''}
        </button>
      </div>
    </div>
  );
}

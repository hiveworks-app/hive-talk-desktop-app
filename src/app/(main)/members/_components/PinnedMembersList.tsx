'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { MemberListItem, type NormalizedMember } from './MemberListItem';

interface PinnedMembersListProps {
  items: NormalizedMember[];
  onClickMember: (id: string) => void;
  onTogglePin: (id: string) => void;
  /** 드래그 종료 시 새 순서(정규화 id 배열) 전달 */
  onReorder: (orderedIds: string[]) => void;
}

/**
 * 관심멤버 드래그 순서변경 목록.
 * - dragOrder가 null이면 서버 순서(items)를 그대로 렌더, 드래그 중에는 dragOrder를 렌더
 *   → useEffect 동기화 없이 prop 변화에 자연스럽게 따라감
 * - 2명 미만이면 드래그 비활성
 */
export function PinnedMembersList({ items, onClickMember, onTogglePin, onReorder }: PinnedMembersListProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<NormalizedMember[] | null>(null);

  const list = dragOrder ?? items;
  const draggable = items.length >= 2;

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    if (!dragId || dragId === overId) return;
    e.preventDefault();
    const base = dragOrder ?? items;
    const from = base.findIndex(m => m.id === dragId);
    const to = base.findIndex(m => m.id === overId);
    if (from === -1 || to === -1) return;
    const next = [...base];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragOrder(next);
  };

  const handleDragEnd = () => {
    if (dragOrder) onReorder(dragOrder.map(m => m.id));
    setDragId(null);
    setDragOrder(null);
  };

  return (
    <div className="mt-1 flex flex-col">
      {list.map(item => (
        <div
          key={item.id}
          draggable={draggable}
          onDragStart={() => setDragId(item.id)}
          onDragOver={e => handleDragOver(e, item.id)}
          onDragEnd={handleDragEnd}
          className={cn(
            draggable && 'cursor-grab active:cursor-grabbing',
            dragId === item.id && 'opacity-50',
          )}
        >
          <MemberListItem
            member={item}
            onClick={() => onClickMember(item.id)}
            isPinned
            onTogglePin={() => onTogglePin(item.id)}
          />
        </div>
      ))}
    </div>
  );
}

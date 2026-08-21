'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';

interface NormalizedMember {
  id: string;
  name: string;
  description: string;
  storageKey?: string | null;
  /** 협력멤버(외부) 여부 — true면 이름 옆에 ∞ 배지 표시 */
  isExternal: boolean;
}

interface MemberListItemProps {
  member: NormalizedMember;
  onClick: () => void;
  /** 더블클릭 = 1:1 채팅 (데스크톱 관례) — 미지정 시 동작 없음 */
  onDoubleClick?: () => void;
  /** 우클릭 컨텍스트 메뉴 (데스크톱 관례) — 미지정 시 브라우저 기본 동작 */
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export type { NormalizedMember };

export function MemberListItem({ member, onClick, onDoubleClick, onContextMenu }: MemberListItemProps) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-gray-50"
    >
      {/* 아바타 36px — 데스크톱 밀도 (행 48px = 36 + py 6×2) */}
      <ProfileCircle name={member.name} size="sm" storageKey={member.storageKey} />
      {/* 이름(+협력멤버 ∞ 배지): 이름은 길면 말줄임, 배지는 고정 */}
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-body text-text-primary">
          {member.name}
        </span>
        {member.isExternal && (
          <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
        )}
      </span>
      {/* 부서·직급: 남은 공간을 채워 우측 정렬, 길면 말줄임 (Figma 패리티) */}
      {member.description && (
        <span className="min-w-0 flex-1 truncate text-right text-sub-sm text-text-secondary">
          {member.description}
        </span>
      )}
    </button>
  );
}

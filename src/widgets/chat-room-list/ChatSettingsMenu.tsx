"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/shared/lib/cn";
import IconSettingDefault from "@assets/icons/setting-default.svg";

export type ChatSortType = "latest" | "favorite";

interface ChatSettingsMenuProps {
  sortType: ChatSortType;
  onSortChange: (sort: ChatSortType) => void;
  onManageRooms: () => void;
}

/**
 * 사내채팅 설정 드롭다운 (헤더 톱니바퀴).
 * 정렬순(최신메시지 순 / 관심멤버 순) + 채팅방 관리. (Figma node 929-12647)
 */
export function ChatSettingsMenu({ sortType, onSortChange, onManageRooms }: ChatSettingsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="설정"
          aria-label="채팅 설정"
          className="flex h-7 w-7 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60 data-[state=open]:bg-gray-200"
        >
          <IconSettingDefault width={20} height={20} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="motion-menu z-50 w-[180px] overflow-hidden rounded-xl bg-white py-1 shadow-[0px_2px_22px_rgba(0,0,0,0.12)] focus:outline-none"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-sub-sm text-text-tertiary">
            정렬순
          </DropdownMenu.Label>
          <SortItem label="최신메시지 순" active={sortType === "latest"} onSelect={() => onSortChange("latest")} />
          <SortItem label="관심멤버 순" active={sortType === "favorite"} onSelect={() => onSortChange("favorite")} />

          <DropdownMenu.Separator className="my-1 h-px bg-divider" />

          <DropdownMenu.Label className="px-3 py-1.5 text-sub-sm text-text-tertiary">
            설정
          </DropdownMenu.Label>
          <DropdownMenu.Item
            onSelect={onManageRooms}
            className="cursor-pointer px-3 py-2.5 text-sub text-text-primary outline-none data-[highlighted]:bg-gray-100"
          >
            채팅방 관리
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SortItem({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center justify-between px-3 py-2.5 text-body outline-none data-[highlighted]:bg-gray-100",
        active ? "font-semibold text-primary" : "text-text-primary",
      )}
    >
      {label}
      {active && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </DropdownMenu.Item>
  );
}

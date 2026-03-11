"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useGetDMRoomList,
  useGetGMRoomList,
  useGetEMRoomList,
} from "@/features/chat-room-list/queries";
import { cn } from "@/shared/lib/cn";
import { toSafeNumber } from "@/shared/utils/utils";
import IconBottomMemberDefault from "@assets/icons/bottom-member-default.svg";
import IconBottomChatDefault from "@assets/icons/bottom-chat-default.svg";
import IconBottomEmChatDefault from "@assets/icons/bottom-em-chat-default.svg";
import IconBottomSettingDefault from "@assets/icons/bottom-setting-default.svg";

function useTotalUnreadCount() {
  const { data: dmList } = useGetDMRoomList();
  const { data: gmList } = useGetGMRoomList();
  const { data: emList } = useGetEMRoomList();

  const sumUnread = (list: typeof dmList) =>
    list?.reduce((sum, item) => sum + toSafeNumber(item.notReadCount, 0), 0) ??
    0;

  const dmUnread = sumUnread(dmList);
  const gmUnread = sumUnread(gmList);
  const emUnread = sumUnread(emList);
  const companyChatBadge = dmUnread + gmUnread;
  const totalUnread = companyChatBadge + emUnread;

  return { companyChatBadge, externalChatBadge: emUnread, totalUnread };
}

const NAV_ITEMS = [
  {
    href: "/members",
    label: "멤버목록",
    Icon: IconBottomMemberDefault,
    badgeKey: null,
  },
  {
    href: "/chat",
    label: "사내채팅",
    Icon: IconBottomChatDefault,
    badgeKey: "company" as const,
  },
  {
    href: "/external-chat",
    label: "협력채팅",
    Icon: IconBottomEmChatDefault,
    badgeKey: "external" as const,
  },
  {
    href: "/settings",
    label: "전체설정",
    Icon: IconBottomSettingDefault,
    badgeKey: null,
  },
];

export function AppNav() {
  const pathname = usePathname();
  const { companyChatBadge, externalChatBadge, totalUnread } =
    useTotalUnreadCount();

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } })
      .electronAPI;
    api?.setBadgeCount?.(totalUnread);
  }, [totalUnread]);

  const getBadgeCount = (key: "company" | "external" | null) => {
    if (key === "company") return companyChatBadge;
    if (key === "external") return externalChatBadge;
    return 0;
  };

  return (
    <nav className="electron-drag flex h-full w-[88px] shrink-0 flex-col items-center border-r border-divider bg-surface pt-16 pb-4">
      {/* 네비게이션 아이템 */}
      <div className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const badgeCount = getBadgeCount(item.badgeKey);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "electron-no-drag flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "bg-state-primary-highlighted text-black"
                  : "text-text-tertiary hover:bg-surface-pressed hover:text-text-secondary",
              )}
            >
              <div className="relative">
                <item.Icon width={28} height={28} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-state-error px-1 text-[9px] font-bold text-on-primary">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

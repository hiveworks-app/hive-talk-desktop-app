"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import IconBottomMemberDefault from "@assets/icons/bottom-member-default.svg";
import IconBottomChatDefault from "@assets/icons/bottom-chat-default.svg";
import IconBottomEmChatDefault from "@assets/icons/bottom-em-chat-default.svg";
import IconBottomSettingDefault from "@assets/icons/bottom-setting-default.svg";

const NAV_ITEMS = [
  {
    href: "/members",
    label: "멤버목록",
    Icon: IconBottomMemberDefault,
  },
  {
    href: "/chat",
    label: "사내채팅",
    Icon: IconBottomChatDefault,
  },
  {
    href: "/external-chat",
    label: "협력채팅",
    Icon: IconBottomEmChatDefault,
  },
  {
    href: "/settings",
    label: "전체설정",
    Icon: IconBottomSettingDefault,
  },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="electron-drag flex h-full w-[88px] shrink-0 flex-col items-center border-r border-divider bg-surface pt-16 pb-4">
      {/* 로고 (macOS 트래픽 라이트 아래 배치) */}
      {/* <div className="electron-no-drag mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-on-primary">
        H
      </div> */}

      {/* 네비게이션 아이템 */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "electron-no-drag flex h-11 w-11 items-center justify-center flex-col gap-1 rounded-xl transition-colors",
                isActive
                  ? "bg-state-primary-highlighted text-black"
                  : "text-text-tertiary hover:bg-surface-pressed hover:text-text-secondary",
              )}
            >
              <item.Icon width={22} height={22} />
              {/* <span className="text-xs font-medium">{item.label}</span> */}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

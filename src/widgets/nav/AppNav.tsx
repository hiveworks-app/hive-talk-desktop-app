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
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/auth/authStore";
import { USER_TYPE } from "@/shared/types/user";
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
    // 사내채팅(DM/GM)은 소속 유저만 — GUEST는 노출하지 않는다 (RN ExtendedBottomNavigation 패리티)
    orgOnly: true,
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
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const isOrgMember = useAuthStore(s => s.user?.userType) === USER_TYPE.ORG_MEMBER;
  const navItems = NAV_ITEMS.filter(item => !item.orgOnly || isOrgMember);
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
    <nav className="electron-drag flex h-full w-[78px] shrink-0 flex-col items-center border-r border-divider bg-surface pt-16 pb-4">
      {/* 네비게이션 아이템 */}
      <div className="flex flex-1 flex-col items-center gap-5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const badgeCount = getBadgeCount(item.badgeKey);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={(e) => {
                if (!navigator.onLine) {
                  e.preventDefault();
                  showSnackbar({ message: '오프라인 상태에서는 이동할 수 없습니다.' });
                }
              }}
              className={cn(
                "electron-no-drag flex w-full flex-col items-center gap-0.5 transition-colors",
                // RN BottomNavigationItem 패리티 — active gray-900 / inactive gray-400
                isActive ? "text-gray-900" : "text-gray-400 hover:text-text-secondary",
              )}
            >
              <div className="relative">
                <item.Icon width={24} height={24} />
                {/* compact 뱃지 — 16px, caption semibold, 999+ 상한.
                    pb-[1px]·pl-[5px]/pr-1 = 스크린샷 실측 기반 광학 보정(Pretendard 디센트 + 글리프 반픽셀):
                    숫자 잉크가 원 중심 대비 0.5px 위/왼쪽에 그려지는 것을 0.5px씩 되밀어 정중앙 */}
                {badgeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-state-error pb-[1px] pl-[5px] pr-1 text-[11px] font-bold leading-none antialiased text-on-primary [font-family:-apple-system,system-ui,sans-serif]">
                    {badgeCount > 999 ? "999+" : badgeCount}
                  </span>
                )}
              </div>
              {/* RN 패리티 — 아이콘 아래 caption 라벨 상시 표시 */}
              <span className="text-caption font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

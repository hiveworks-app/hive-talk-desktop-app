"use client";

import { useCallback, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/shared/lib/cn";
import { FindIdContent } from "./_components/FindIdContent";
import { FindPasswordContent } from "./_components/FindPasswordContent";

export default function FindAccountPage() {
  const [selectedTab, setSelectedTab] = useState<string>("findId");
  const [passwordTabEmail, setPasswordTabEmail] = useState("");
  const [findIdKey, setFindIdKey] = useState(0);
  const [findPasswordKey, setFindPasswordKey] = useState(0);

  const handleFoundEmail = useCallback((email: string) => {
    setPasswordTabEmail(email);
    setFindPasswordKey((prev) => prev + 1);
    setSelectedTab("findPassword");
  }, []);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value === selectedTab) return;
      if (value === "findId") {
        setFindIdKey((prev) => prev + 1);
        setPasswordTabEmail("");
      } else {
        setFindPasswordKey((prev) => prev + 1);
        setPasswordTabEmail("");
      }
      setSelectedTab(value);
    },
    [selectedTab],
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* 헤더 */}
      <div className="flex h-14 items-center gap-1 px-4">
        <button
          onClick={() => { window.location.href = "/login"; }}
          className="flex items-center text-text-primary hover:text-text-secondary"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-heading-lg font-semibold text-text-primary">
          계정정보 찾기
        </span>
      </div>

      {/* 탭 */}
      <Tabs.Root
        value={selectedTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <Tabs.List className="mx-4 mt-[30px] flex overflow-hidden">
          <Tabs.Trigger
            value="findId"
            className={cn(
              "flex-1 items-center justify-center rounded-l-xl border py-3 text-heading-sm font-medium transition-colors",
              selectedTab === "findId"
                ? "border-primary bg-[#E6F3FF] text-primary"
                : "border-gray-200 bg-white text-gray-500",
            )}
          >
            아이디 찾기
          </Tabs.Trigger>
          <Tabs.Trigger
            value="findPassword"
            className={cn(
              "flex-1 items-center justify-center rounded-r-xl border py-3 text-heading-sm font-medium transition-colors",
              selectedTab === "findPassword"
                ? "border-primary bg-[#E6F3FF] text-primary"
                : "border-gray-200 bg-white text-gray-500",
            )}
          >
            비밀번호 찾기
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="findId" className="flex flex-1 flex-col">
          <FindIdContent key={findIdKey} onFoundEmail={handleFoundEmail} />
        </Tabs.Content>

        <Tabs.Content value="findPassword" className="flex flex-1 flex-col">
          <FindPasswordContent
            key={findPasswordKey}
            initialEmail={passwordTabEmail}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

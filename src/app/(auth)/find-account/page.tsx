"use client";

import { useCallback, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/shared/lib/cn";
import { useEscClose } from "@/shared/hooks/useEscClose";
import { FindIdContent } from "./_components/FindIdContent";
import { FindPasswordContent } from "./_components/FindPasswordContent";

export default function FindAccountPage() {
  const [selectedTab, setSelectedTab] = useState<string>("findId");
  const [passwordTabEmail, setPasswordTabEmail] = useState("");
  const [findIdKey, setFindIdKey] = useState(0);
  const [findPasswordKey, setFindPasswordKey] = useState(0);
  // 결과/완료 단계에서 상단 탭 숨김 — 결과에 집중 (RN showSegment 패리티)
  const [hideTabs, setHideTabs] = useState(false);

  // ESC = ←(로그인으로)와 동일 — 억제 없으면 ESC가 앱 창을 트레이로 숨긴다 (2026-09-03 전수 감사)
  useEscClose(true, () => { window.location.href = "/login"; });

  const handleFoundEmail = useCallback((email: string) => {
    // 비밀번호 찾기 탭 프리필만 준비 — 탭을 강제 전환하면 Radix Tabs가 결과 화면을
    // 즉시 언마운트해 마스킹 이메일이 한 프레임도 보이지 않았다 (2026-08-26 감사, RN은 결과 유지)
    setPasswordTabEmail(email);
    setFindPasswordKey((prev) => prev + 1);
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
    // fixed inset-0: (auth) 레이아웃의 safe-top 상태와 무관하게 자체 골격으로 렌더
    // (오버레이 화면들과 동일 패턴 — 신호등 겹침 방지는 내부 드래그 바가 담당)
    <div className="fixed inset-0 z-10 flex flex-col bg-white">
      {/* macOS 신호등 영역 확보용 드래그 바 */}
      <div className="electron-drag h-8 w-full shrink-0" />

      {/* 헤더 — 52px, 중앙 타이틀 + 좌측 ← (오버레이 화면 공통 패턴) */}
      <div className="relative h-[52px] shrink-0">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[100px]">
          <h2 className="truncate text-heading-md font-medium text-text-primary">계정정보 찾기</h2>
        </div>
        <div className="flex h-full items-center px-4">
          <button
            onClick={() => { window.location.href = "/login"; }}
            aria-label="뒤로가기"
            className="flex h-8 w-8 items-center justify-center text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 탭 + 컨텐츠 — 폭 제한(로그인과 동일 400px)으로 전폭 늘어짐 방지 */}
      <Tabs.Root
        value={selectedTab}
        onValueChange={handleTabChange}
        className="mx-auto flex w-full max-w-[400px] flex-1 flex-col overflow-y-auto"
      >
        <Tabs.List className={cn("mx-4 mt-4 flex shrink-0 overflow-hidden", hideTabs && "hidden")}>
          <Tabs.Trigger
            value="findId"
            className={cn(
              "h-10 flex-1 items-center justify-center rounded-l-lg border text-body font-medium transition-colors",
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
              "h-10 flex-1 items-center justify-center rounded-r-lg border text-body font-medium transition-colors",
              selectedTab === "findPassword"
                ? "border-primary bg-[#E6F3FF] text-primary"
                : "border-gray-200 bg-white text-gray-500",
            )}
          >
            비밀번호 찾기
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="findId" className="flex flex-1 flex-col">
          <FindIdContent key={findIdKey} onFoundEmail={handleFoundEmail} onStepChange={setHideTabs} />
        </Tabs.Content>

        <Tabs.Content value="findPassword" className="flex flex-1 flex-col">
          <FindPasswordContent
            key={findPasswordKey}
            initialEmail={passwordTabEmail}
            onStepChange={setHideTabs}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

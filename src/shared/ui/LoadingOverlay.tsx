"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useUIStore } from "@/store/uiStore";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const BAR_WIDTH = 240;

/** progress가 없을 때: 좌우로 슬라이딩하는 indeterminate bar */
function IndeterminateBar() {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-white/20"
      style={{ width: BAR_WIDTH }}
    >
      <div className="h-full w-20 animate-indeterminate rounded-full bg-primary" />
    </div>
  );
}

/** progress 0~1: 실제 진행률 표시 determinate bar */
function DeterminateBar({ progress }: { progress: number }) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-white/20"
      style={{ width: BAR_WIDTH }}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: clamped * BAR_WIDTH }}
      />
    </div>
  );
}

export function LoadingOverlay() {
  const { visible, message, progress } = useUIStore((s) => s.loadingOverlay);
  const [animationData, setAnimationData] = useState<unknown>(null);

  useEffect(() => {
    fetch("/loading-bee.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => {});
  }, []);

  if (!visible) return null;

  const isDeterminate = typeof progress === "number";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
      <div className="flex flex-col items-center gap-3">
        <div className="h-20 w-20">
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </div>
          )}
        </div>
        {isDeterminate ? (
          <DeterminateBar progress={progress} />
        ) : (
          <IndeterminateBar />
        )}
        {message && (
          <span className="text-center text-sub font-medium text-white">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

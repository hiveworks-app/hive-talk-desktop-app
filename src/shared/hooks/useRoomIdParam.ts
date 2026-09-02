'use client';

import { useSearchParams } from 'next/navigation';

/**
 * 채팅방 라우트의 roomId — 정적 export 전환(2026-09-02)으로 동적 세그먼트(/chat/[roomId])
 * 대신 쿼리 파라미터(/chat?roomId=…)를 쓴다. useSearchParams는 정적 프리렌더 시 Suspense
 * 경계가 필요 — 채팅 레이아웃(chat/external-chat)과 각 단독 페이지가 경계를 제공한다.
 */
export function useRoomIdParam(): string | undefined {
  return useSearchParams().get('roomId') ?? undefined;
}

/** 채팅방 이동 경로 생성 — 모든 방 네비게이션이 이 형태를 공유한다 */
export function roomPath(prefix: string, roomId: string): string {
  return `${prefix}?roomId=${encodeURIComponent(roomId)}`;
}

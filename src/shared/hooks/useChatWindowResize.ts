'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** 채팅방 화면 경로: /chat/{id}, /chat/new, /external-chat/{id} 등 (목록 경로 /chat·/external-chat 은 제외) */
const ROOM_ROUTE = /^\/(chat|external-chat)\/.+/;

type ChatResizeApi = { setChatRoomActive?: (active: boolean) => void };

/**
 * 채팅방 진입/이탈에 따라 Electron 창 폭을 동적으로 조절한다.
 * 평상시(목록·멤버·설정)는 좁게, 채팅방에서는 넓게. (웹 환경에선 electronAPI가 없어 no-op)
 *
 * 직전 상태를 기억해 "전환 시점"에만 1회 호출 — 방↔방 이동(둘 다 room)에서는 호출하지 않는다.
 */
export function useChatWindowResize() {
  const pathname = usePathname();
  const lastActiveRef = useRef<boolean | null>(null);

  useEffect(() => {
    const active = ROOM_ROUTE.test(pathname);
    if (lastActiveRef.current === active) return;
    lastActiveRef.current = active;

    const api = (window as unknown as { electronAPI?: ChatResizeApi }).electronAPI;
    api?.setChatRoomActive?.(active);
  }, [pathname]);
}

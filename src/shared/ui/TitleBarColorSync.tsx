'use client';

import { useTitleBarColor } from '@/shared/hooks/useTitleBarColor';

/**
 * Windows/Linux 타이틀바 버튼(WCO) 영역 배경을 화면 상단 색과 동기화하는 마커 컴포넌트.
 * gray-50 상단의 풀스크린 오버레이(프로필 셸·검색 오버레이 등) JSX에 한 줄 꽂아 쓴다 —
 * 마운트 시 선언, 언마운트 시 흰색 복원 (useTitleBarColor 참조).
 */
export function TitleBarColorSync({ color }: { color: string }) {
  useTitleBarColor(color);
  return null;
}

import { useEffect } from 'react';
import { useUIStore } from '@/store';

// 스크림은 동시에 겹칠 수 있다(확인 팝업 위 로딩 오버레이 등) — 불리언 토글이면 위층이
// 닫힐 때 아래층 dim까지 꺼지므로 참조 카운트로 관리한다
let dimCount = 0;

/**
 * 어두운 스크림이 창 전체(타이틀바 대역 포함)를 덮는 동안 Windows WCO 버튼을
 * dim 색(#666666)으로 동기화한다 — 중앙 확인 모달·로딩 오버레이 계열 전용.
 *
 * 주의: 프로필·방 만들기 같은 밝은 풀스크린 오버레이에는 쓰지 않는다 — dim이 base층
 * (useTitleBarColor의 화면 배경색 선언)보다 우선 적용되어 밝은 화면 위에 어두운 버튼
 * 네모가 뜬다 (2026-09-01 QA, 프로필 수정 화면 실측).
 */
export function useDimmed(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    dimCount += 1;
    if (dimCount === 1) useUIStore.getState().setDimmed(true);
    return () => {
      dimCount -= 1;
      if (dimCount === 0) useUIStore.getState().setDimmed(false);
    };
  }, [isOpen]);
}

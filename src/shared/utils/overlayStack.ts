/**
 * 풀스크린 오버레이 ESC 스택.
 *
 * 오버레이가 겹쳐 열리는 경우(멤버검색 → 프로필, 프로필 → 멤버초대 등)
 * 각 오버레이가 window keydown으로 ESC를 처리하면 등록 순서(아래층 먼저)대로
 * 모두 실행돼 ESC 한 번에 전 층이 동시에 닫힌다. 열림 순서를 스택으로 추적해
 * "자신이 최상단일 때만" 닫도록 판별한다. (RN 네비게이션 back = 최상단 pop 대응)
 */
let stack: symbol[] = [];

export function pushOverlay() {
  const id = Symbol('overlay');
  stack.push(id);
  return {
    /** 이 오버레이가 현재 최상단인지 — ESC 처리 전 확인용 */
    isTop: () => stack[stack.length - 1] === id,
    release: () => {
      stack = stack.filter(s => s !== id);
    },
  };
}

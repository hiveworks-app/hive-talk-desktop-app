let suppressCount = 0;

function sync() {
  const api = (window as unknown as { electronAPI?: { setSuppressEsc?: (v: boolean) => void } })
    .electronAPI;
  api?.setSuppressEsc?.(suppressCount > 0);
}

/**
 * Electron 메인의 ESC→창 숨김(before-input-event)을 억제하는 참조 카운터.
 *
 * 풀스크린 오버레이(프로필·멤버목록 편집)와 미디어 뷰어가 중첩될 수 있는데,
 * 단일 boolean IPC를 각자 직접 토글하면 먼저 닫힌 쪽이 억제를 풀어버려
 * 아래층이 열려 있는데도 다음 ESC가 앱 창을 숨긴다. 마지막 하나가 닫힐 때만 해제한다.
 *
 * @returns 해제 함수 (멱등 — 중복 호출 안전)
 */
export function acquireEscSuppress(): () => void {
  suppressCount += 1;
  sync();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressCount = Math.max(0, suppressCount - 1);
    sync();
  };
}

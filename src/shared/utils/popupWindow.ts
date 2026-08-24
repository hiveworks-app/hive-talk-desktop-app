/**
 * 멀티 채팅창(팝업) 판별 유틸.
 *
 * 팝업은 대화 하나만 담는 단독 창이라 "목록으로 돌아간다"는 개념이 없다.
 * 목록 라우팅(`/chat`)을 그대로 태우면 팝업이 (main) 셸을 로드해 **앱 전체 창이 하나 더 뜬 것처럼**
 * 보인다 — 프로토타입 초기에 실제로 발생했던 문제라 나가기/강제 퇴장 경로마다 차단이 필요하다.
 *
 * ⚠️ 렌더 분기에 쓰지 말 것: 서버 렌더에는 window가 없어 첫 프레임이 어긋난다.
 *    이벤트 핸들러·effect 안에서만 호출한다.
 */
export const isPopupWindow = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/chat-popup');

/**
 * 팝업이면 창을 닫고 true를 반환한다. 팝업이 아니면 아무것도 하지 않고 false —
 * 호출부는 `if (!closeIfPopup()) router.push(...)` 형태로 기존 라우팅을 유지한다.
 */
export const closeIfPopup = () => {
  if (!isPopupWindow()) return false;
  window.close();
  return true;
};

// 앱 환경 (dev, staging, production)
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'dev';
export const IS_PRODUCTION = APP_ENV === 'production';

// 일정시간마다 다시 정보를 가져오도록 요청하는 시간 -> [친구목록, 태그목록]
export const CHECK_HOURS_MS = 4 * 60 * 60 * 1000;

// 멤버목록·관심멤버 자동 갱신 주기 (RN 패리티 — 5분 경과 + 포커스 복귀 시 refetch)
export const MEMBERS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// 한번에 채팅 메시지 가져올 양
export const CHAT_MESSAGE_SIZE = 100;
export const CHAT_BEFORE_SIZE = CHAT_MESSAGE_SIZE;
export const CHAT_AFTER_SIZE = CHAT_MESSAGE_SIZE;

// 앨범선택기 최대 선택 개수
export const MEDIA_PICKER_MAX_SELECT_CNT = 100;
// 앨범선택기에서 선택한 이미지 한 메시지에 담을 개수
export const MAX_IMAGES_PER_MESSAGE = 30;
export const IMAGE_UPLOAD_CONCURRENCY = 4;

export const IS_DELETE_MESSAGE_COMMENTS = '메시지가 삭제되었어요.'; // RN 정본 카피

// 탈퇴 사용자 표시명 — 서버는 sender.isDeleted 플래그만 주고 이름은 원본 유지(RN 실측),
// "알 수 없음" + 기본 이미지 익명화는 클라이언트 책임 (정책 user.md §회원탈퇴).
export const UNKNOWN_USER_NAME = '알 수 없음';

// 메시지 삭제 가능 기간 (24시간)
// 전송 후 24시간이 지난 본인 메시지는 삭제 불가 (정책 chat-room.md, 서버 거절 코드 DM006).
// 클라이언트는 이 값으로 컨텍스트 메뉴 삭제 항목을 사전 게이팅하고,
// 경계값/시계 오차로 요청이 새어나갈 경우 서버 삭제 실패 응답 토스트가 최종 방어선이 된다.
export const MESSAGE_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

// 장문 메시지 '전체보기' 접힘 (RN bubbleTextLimits 패리티)
export const BUBBLE_TEXT_TRUNCATE_CHARS = 500;
export const BUBBLE_TEXT_TRUNCATE_LINES = 15;
/** 접힘 표시용 슬라이스 — 수천 자 장문의 렌더 비용 상한 (전체는 '전체보기'에서) */
export const BUBBLE_TEXT_DISPLAY_SLICE_CHARS = 800;

// 신규 멤버 표시 기간 (24시간) — 사내멤버=joinedAt, 협력멤버=contactedAt 기준.
// MESSAGE_DELETE_WINDOW_MS와 우연히 같은 값일 뿐 별개 정책이므로 합치지 말 것.
export const NEW_MEMBER_WINDOW_MS = 24 * 60 * 60 * 1000;

// 채팅방 나가기 확인 카피 (RN 패리티 — DM은 1:1이라 재초대 안내 불필요)
export const LEAVE_CONFIRM_DESCRIPTION = {
  SIMPLE: '채팅방을 나가시겠어요?',
  GROUP: '채팅방을 나가시겠어요?\n나가면 초대받아야 다시 입장할 수 있어요.',
} as const;

// 신고 카테고리 캐시 유지 시간 (운영 중 변경이 드물어 1시간)
export const REPORT_CATEGORIES_STALE_TIME_MS = 60 * 60 * 1000;

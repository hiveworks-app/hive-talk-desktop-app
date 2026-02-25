// 앱 환경 (dev, staging, production)
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'dev';
export const IS_PRODUCTION = APP_ENV === 'production';

// 일정시간마다 다시 정보를 가져오도록 요청하는 시간 -> [친구목록, 태그목록]
export const CHECK_HOURS_MS = 4 * 60 * 60 * 1000;

// 한번에 채팅 메시지 가져올 양
export const CHAT_MESSAGE_SIZE = 100;
export const CHAT_BEFORE_SIZE = CHAT_MESSAGE_SIZE;
export const CHAT_AFTER_SIZE = CHAT_MESSAGE_SIZE;

// 앨범선택기 최대 선택 개수
export const MEDIA_PICKER_MAX_SELECT_CNT = 100;
// 앨범선택기에서 선택한 이미지 한 메시지에 담을 개수
export const MAX_IMAGES_PER_MESSAGE = 30;
export const IMAGE_UPLOAD_CONCURRENCY = 4;

export const IS_DELETE_MESSAGE_COMMENTS = '삭제된 메시지입니다.';

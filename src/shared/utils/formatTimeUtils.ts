/**
 * 한국식 시간 포맷으로 변환
 * - 출력 예: "오전 9:05", "오후 12:30"
 */
export function formatKoreanTime(isoString: string) {
  const date = new Date(isoString);

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const period = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');

  return `${period} ${h}:${m}`;
}

/**
 * 마지막 동기화 시각 표기 — "M월 D일 오전/오후 H:MM"
 */
export function formatSyncedAt(input: Date | number | string) {
  const date = new Date(input);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  return `${month}월 ${day}일 ${period} ${h}:${minutes}`;
}

/**
 * 채팅용 한국식 날짜/시간 포맷
 * - 오늘 → "오전/오후 HH:MM"
 * - 올해 과거 날짜 → "MM-DD"
 * - 예전 날짜 → "YYYY-MM-DD"
 */
export function formatChatTimestamp(isoString: string) {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();

  const isSameDay = year === nowYear && month === nowMonth && day === nowDay;
  const isSameYear = year === nowYear;

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  const timeString = `${period} ${h}:${m}`;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  if (isSameDay) {
    return timeString;
  }

  if (isSameYear) {
    return `${mm}-${dd}`;
  }

  return `${year}-${mm}-${dd}`;
}

export function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDayOfTheWeek(index: number) {
  const dayOfTheWeek = ['일', '월', '화', '수', '목', '금', '토'];
  return dayOfTheWeek[index];
}

export function formatChatDateLabel(isoString: string) {
  const isoDate = new Date(isoString);

  const month = isoDate.getMonth() + 1;
  const date = isoDate.getDate();
  const day = isoDate.getDay();

  return `${isoDate.getFullYear()}년 ${month}월 ${date}일 ${getDayOfTheWeek(day)}요일`;
}

/**
 * 동영상 길이(초)를 M:SS 로 포맷.
 * - 0/음수/undefined/비유한 → 빈 문자열(배지 미표시)
 * - 예: 75 → "1:15", 8 → "0:08"
 */
export function formatMediaDuration(seconds?: number) {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return '';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

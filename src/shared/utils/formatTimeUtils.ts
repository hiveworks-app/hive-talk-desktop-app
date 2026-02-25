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

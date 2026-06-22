import { NoticePill } from './NoticePill';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function DateSeparator({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const formatted = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`;
  return <NoticePill className="my-4">{formatted}</NoticePill>;
}

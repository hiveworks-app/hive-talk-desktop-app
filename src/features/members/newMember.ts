import { NEW_MEMBER_WINDOW_MS } from '@/shared/config/constants';
import type { MemberItem } from '@/shared/types/user';

/** 서버 날짜 문자열 방어 파싱 — null/''/NaN이면 null (마이크로초 포함 ISO 대응) */
function parseServerDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 신규 멤버 판정 기준 시각 (RN features/members/newMember.ts 패리티).
 * ⚠️ 사내멤버도 contactedAt이 동일 값으로 채워져 내려오므로(서버 실측) 반드시 isExternal 분기.
 * 기준 필드 없는 legacy 멤버는 신규 아님(null).
 */
export function getMemberNewSince(item: MemberItem): number | null {
  const raw = item.isExternal === true ? item.contactedAt : item.joinedAt;
  const date = parseServerDate(raw);
  return date ? date.getTime() : null;
}

export function isNewMember(item: MemberItem, now: number): boolean {
  const since = getMemberNewSince(item);
  return since != null && now - since < NEW_MEMBER_WINDOW_MS;
}

/** 신규 멤버 필터 + since 내림차순 정렬 (최신이 앞) */
export function selectNewMembers(members: MemberItem[], now: number): MemberItem[] {
  return members
    .filter(m => isNewMember(m, now))
    .sort((a, b) => (getMemberNewSince(b) ?? 0) - (getMemberNewSince(a) ?? 0));
}

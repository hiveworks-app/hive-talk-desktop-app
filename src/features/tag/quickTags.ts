import { TAG_NAMES } from '@/shared/ui/TagIcon';

/** 컨텍스트 메뉴 태그 빠른선택 슬롯 수 (RN CONTEXT_MENU_TAG_SLOTS 패리티) */
export const CONTEXT_MENU_TAG_SLOTS = 5;

/**
 * 태그 빠른선택 슬롯 합성 (RN composeContextMenuTags 패리티).
 * [메시지에 달린 태그(최대 3, 활성 표시)] + [최근 사용 태그] + [기본 순서 fill] — 총 5칸, dedup.
 */
export function composeContextMenuTags(
  messageTagTitles: string[],
  recentTagNames: string[],
): string[] {
  const result: string[] = [];
  for (const title of messageTagTitles.slice(0, 3)) {
    if (title && !result.includes(title)) result.push(title);
  }
  for (const title of recentTagNames) {
    if (result.length >= CONTEXT_MENU_TAG_SLOTS) break;
    if (title && !result.includes(title)) result.push(title);
  }
  for (const title of TAG_NAMES) {
    if (result.length >= CONTEXT_MENU_TAG_SLOTS) break;
    if (!result.includes(title)) result.push(title);
  }
  return result.slice(0, CONTEXT_MENU_TAG_SLOTS);
}

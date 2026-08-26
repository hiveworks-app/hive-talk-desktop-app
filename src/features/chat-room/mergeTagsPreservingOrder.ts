import type { TagListType } from '@/shared/types/tag';

/**
 * 태그 브로드캐스트를 "표시 순서 안정성" 기준으로 병합한다. (RN model/mergeTagsPreservingOrder 패리티)
 *
 * 서버는 태그 목록의 순서를 보장하지 않아, 같은 "추가" 동작인데도 새 태그가 어떤 응답에선
 * 앞에, 어떤 응답에선 뒤에 나타난다 (RN 2026-07-20 QA 실측). 렌더는 배열 순서를 그대로
 * 그리므로, 서버 응답 순서를 그대로 쓰면 기존 태그 위치가 흔들린다.
 *
 * 병합 규칙 (서버 응답 순서에 의존하지 않는 결정론):
 * 1. 기존 태그 중 서버 응답에도 있는 것은 현재 표시 위치를 그대로 유지한다.
 * 2. 서버 응답에만 있는(=이번에 새로 붙은) 태그는 항상 끝에 추가한다.
 * 3. 서버 응답에서 빠진(=해제된) 태그는 제거한다.
 *
 * 태그 객체 자체는 서버 최신본(fresh)을 쓴다 — taggingId 등 갱신값 반영을 위해.
 */
export function mergeTagsPreservingOrder(
  prevTags: TagListType[] | undefined,
  freshTags: TagListType[],
): TagListType[] {
  const freshByTagId = new Map<number, TagListType>();
  for (const tag of freshTags) {
    freshByTagId.set(Number(tag.tagId), tag);
  }

  const result: TagListType[] = [];

  // 1) 기존 순서 유지 — 아직 존재하는 태그만, 서버 최신본으로
  for (const prevTag of prevTags ?? []) {
    const key = Number(prevTag.tagId);
    const fresh = freshByTagId.get(key);
    if (fresh) {
      result.push(fresh);
      freshByTagId.delete(key);
    }
  }

  // 2) 새 태그는 끝에 (서버 응답 순서 유지)
  for (const tag of freshTags) {
    if (freshByTagId.has(Number(tag.tagId))) {
      result.push(tag);
      freshByTagId.delete(Number(tag.tagId));
    }
  }

  return result;
}

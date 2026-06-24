/**
 * 업무태그 종류 (POC 기준 20개 고정 — domain-feature/chat-room.md)
 * 정렬 순서가 곧 기본 정렬순이며, 바텀시트 그리드 노출 순서와 동일.
 */
export const TAG_NAMES = [
  '작업지연',
  '결품',
  '오투입',
  '입고지연',
  '비가동',
  '설비정지',
  '금형',
  '설비고장',
  '인원부족',
  '불량',
  '부적합',
  '검사이슈',
  '재작업',
  '계획변경',
  '정보불일치',
  '협력사이슈',
  '고객이슈',
  '개선필요',
  '클레임',
  '폐기',
] as const;

export type TagName = (typeof TAG_NAMES)[number];

export interface TagIconProps {
  /** 태그명 (서버 title). 매핑되지 않은 이름은 fallback 아이콘으로 렌더링됨. */
  name: TagName | (string & {});
  /** 선택 상태 — 컨테이너 배경/테두리/라벨 색만 변경 (아이콘은 다색 고정). */
  selected?: boolean;
  /** 비활성 (예: UPDATE 모드에서 다른 사용자가 단 태그는 해제 불가). */
  disabled?: boolean;
  onClick?: () => void;
  /** 정사각형 컨테이너 크기(px). 기본 56 (Figma 기준). */
  size?: number;
}

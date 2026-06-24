import type { FC, SVGProps } from 'react';
import {
  TagClaim,
  TagCustomerIssue,
  TagDefect,
  TagDisposal,
  TagDowntime,
  TagEquipmentFailure,
  TagEquipmentStop,
  TagImprovementNeeded,
  TagInfoMismatch,
  TagInspectionIssue,
  TagManpowerShortage,
  TagMold,
  TagNonconformity,
  TagPlanChange,
  TagReceivingDelay,
  TagRework,
  TagShortage,
  TagVendorIssue,
  TagWorkDelay,
  TagWrongInput,
} from '@assets/icons/tags';
import type { TagName } from './type';

export type TagSvgComponent = FC<SVGProps<SVGSVGElement>>;

/**
 * 태그명 → SVG 컴포넌트 매핑.
 *
 * RN 앱(hivetalk)의 tagIconMap.ts 와 1:1 동일하게 유지한다.
 * (에셋 ↔ 태그명 매핑이 RN/데스크톱에서 어긋나면 같은 메시지의 태그가
 *  플랫폼별로 다른 아이콘으로 보이므로 의도적으로 동기화.)
 * 매핑되지 않은 태그는 TagIcon 에서 fallback 아이콘으로 렌더링됨.
 */
export const TAG_ICON_MAP: Partial<Record<TagName, TagSvgComponent>> = {
  작업지연: TagWorkDelay,
  결품: TagInspectionIssue,
  오투입: TagWrongInput,
  입고지연: TagMold,
  비가동: TagDowntime,
  설비정지: TagEquipmentStop,
  금형: TagReceivingDelay,
  설비고장: TagEquipmentFailure,
  인원부족: TagManpowerShortage,
  불량: TagDefect,
  부적합: TagNonconformity,
  검사이슈: TagPlanChange,
  재작업: TagRework,
  계획변경: TagInfoMismatch,
  정보불일치: TagShortage,
  협력사이슈: TagVendorIssue,
  고객이슈: TagCustomerIssue,
  개선필요: TagImprovementNeeded,
  클레임: TagClaim,
  폐기: TagDisposal,
};

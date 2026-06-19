/** 정책 문서의 한 섹션. title 없이 body만 있는 도입/마무리 문단도 허용한다. */
export interface PolicySection {
  title?: string;
  body: string;
}

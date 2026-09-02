'use client';

import { Suspense } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import { POLICY_DOCS, isPolicyDocSlug } from '@/features/policy/content';
import { PolicyDocument } from '../_components/PolicyDocument';

// 정적 export 전환 — /settings/policy/[doc] 대신 /settings/policy?doc=… 쿼리를 쓴다
function PolicyDocInner() {
  const slug = useSearchParams().get('doc') ?? '';

  if (!isPolicyDocSlug(slug)) {
    notFound();
  }

  const doc = POLICY_DOCS[slug];
  return <PolicyDocument title={doc.title} sections={doc.sections} />;
}

export default function PolicyDocPage() {
  // useSearchParams(doc)의 정적 프리렌더 경계
  return (
    <Suspense fallback={null}>
      <PolicyDocInner />
    </Suspense>
  );
}

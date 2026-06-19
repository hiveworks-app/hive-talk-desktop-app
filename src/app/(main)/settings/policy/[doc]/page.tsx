'use client';

import { notFound, useParams } from 'next/navigation';
import { POLICY_DOCS, isPolicyDocSlug } from '@/features/policy/content';
import { PolicyDocument } from '../../_components/PolicyDocument';

export default function PolicyDocPage() {
  const params = useParams<{ doc: string }>();
  const slug = params.doc;

  if (!isPolicyDocSlug(slug)) {
    notFound();
  }

  const doc = POLICY_DOCS[slug];
  return <PolicyDocument title={doc.title} sections={doc.sections} />;
}

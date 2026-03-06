'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import type { SignupTerm } from '@/features/signup/type';

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-gray-300',
      )}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

export function TermsStep({
  terms,
  agreedTermIds,
  onToggle,
  onToggleAll,
  onNext,
}: {
  terms: SignupTerm[];
  agreedTermIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onNext: () => void;
}) {
  const requiredTerms = terms.filter(t => t.isRequired);
  const allRequiredAgreed = requiredTerms.every(t => agreedTermIds.has(t.id));
  const [detailTerm, setDetailTerm] = useState<SignupTerm | null>(null);

  const canViewDetail = (term: SignupTerm) =>
    !!term.description && !term.title.includes('만 14세');

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-5">
      {/* 타이틀 */}
      <h2 className="mb-6 text-heading-xl font-semibold text-text-primary">약관동의</h2>

      {/* 전체 동의 */}
      <button
        onClick={onToggleAll}
        className="flex h-[50px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Checkbox checked={agreedTermIds.size === terms.length} />
        <span className="text-heading-sm font-semibold text-text-primary">약관 전체 동의하기 (선택 동의 포함)</span>
      </button>

      {/* 개별 약관 */}
      <div className="space-y-1">
        {terms.map(term => (
          <div key={term.id} className="flex items-center rounded-lg py-2.5 hover:bg-surface-pressed">
            <button
              onClick={() => onToggle(term.id)}
              className="flex flex-1 items-center gap-2.5 px-4 text-left"
            >
              <Checkbox checked={agreedTermIds.has(term.id)} />
              <span className="flex-1 text-sub text-text-primary">
                {term.title} {term.isRequired ? '(필수)' : '(선택)'}
              </span>
            </button>
            {canViewDetail(term) && (
              <button
                onClick={() => setDetailTerm(term)}
                className="pr-3 pl-1 text-text-tertiary"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 다음 버튼 */}
      <div className="pt-6 pb-4">
        <Button
          variant={allRequiredAgreed ? 'primary' : 'dark'}
          size="lg"
          fullWidth
          onClick={onNext}
          disabled={!allRequiredAgreed}
        >
          다음
        </Button>
      </div>

      {/* 약관 상세 다이얼로그 */}
      {detailTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex max-h-[80vh] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <h3 className="text-heading-sm font-semibold text-text-primary">{detailTerm.title}</h3>
              <button onClick={() => setDetailTerm(null)} className="text-text-tertiary hover:text-text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap text-sub text-text-secondary">{detailTerm.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

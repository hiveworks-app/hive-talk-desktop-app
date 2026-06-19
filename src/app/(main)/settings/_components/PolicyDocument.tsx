'use client';

import type { PolicySection } from '@/features/policy/type';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { IconChevronLeft } from '@/shared/ui/icons';
import { SettingsOverlay } from './SettingsOverlay';

interface PolicyDocumentProps {
  title: string;
  sections: PolicySection[];
}

/**
 * 정적 정책 문서 뷰어 (이용약관·개인정보·마케팅·광고 수신 동의 공용).
 * body의 줄바꿈(\n)은 whitespace-pre-line으로 보존한다.
 */
export function PolicyDocument({ title, sections }: PolicyDocumentProps) {
  const router = useAppRouter();

  return (
    <SettingsOverlay bg="bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button
          onClick={() => router.back()}
          className="electron-no-drag text-text-tertiary hover:text-text-secondary"
          aria-label="뒤로가기"
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 className="truncate text-heading-md font-bold text-text-primary">{title}</h2>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-[640px] space-y-4">
          {sections.map((section, index) => (
            <section key={index}>
              {section.title && (
                <h3 className="text-sub font-semibold text-text-primary">{section.title}</h3>
              )}
              <p
                className={`whitespace-pre-line text-sub leading-relaxed text-text-secondary ${
                  section.title ? 'mt-1' : ''
                }`}
              >
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </SettingsOverlay>
  );
}

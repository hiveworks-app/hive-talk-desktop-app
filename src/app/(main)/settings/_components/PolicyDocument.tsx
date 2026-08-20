'use client';

import type { PolicySection } from '@/features/policy/type';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
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
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
        <h2 className="max-w-[calc(100%-5.5rem)] truncate text-heading-md font-medium text-text-primary">
          {title}
        </h2>
        <button
          onClick={() => router.back()}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-[640px] space-y-4">
          {sections.map((section, index) => (
            <section key={index}>
              {/* RN PolicyDocumentScreen 패리티 — 제목·본문 모두 text-sub regular gray-900 */}
              {section.title && (
                <h3 className="text-sub text-gray-900">{section.title}</h3>
              )}
              <p
                className={`whitespace-pre-line text-sub text-gray-900 ${
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

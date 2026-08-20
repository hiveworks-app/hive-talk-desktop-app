'use client';

import { FileTypeIcon } from '@/shared/ui/FileTypeIcon';
import { extractFileName, formatBytes } from '@/shared/utils/fileUtils';
import type { MessageFileItem } from '@/shared/types/websocket';

interface ChatFileCardProps {
  file: MessageFileItem;
  /** 업로드 중/실패 로컬 메시지 — 다운로드 링크 없이 카드만 표시 */
  disabled?: boolean;
  /** 검색 키워드 — 파일명 매칭 글자 하이라이트 (RN ChatFile 패리티) */
  highlightKeyword?: string | null;
}

/** 검색 키워드 매칭 글자 하이라이트 — 검색 매칭 기준(extractFileName)과 동일 문자열에 적용 */
function renderHighlightedFileName(fileName: string, keyword?: string | null) {
  if (!keyword?.trim()) return fileName;
  const lowerName = fileName.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (;;) {
    const idx = lowerName.indexOf(lowerKeyword, cursor);
    if (idx === -1) {
      parts.push(fileName.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(fileName.slice(cursor, idx));
    parts.push(
      <mark key={idx} className="rounded-sm bg-[#FFED66] text-inherit">
        {fileName.slice(idx, idx + keyword.length)}
      </mark>,
    );
    cursor = idx + keyword.length;
  }
  return parts;
}

/** S3 path 마지막 세그먼트에서 파일명을 추출하고, 퍼센트 인코딩이면 디코드한다. */
function resolveFileName(path: string): string {
  const raw = extractFileName(path);
  try {
    return decodeURIComponent(raw) || raw;
  } catch {
    return raw;
  }
}

/**
 * 채팅 파일 메시지 카드 (Figma 1334-33805).
 * 흰 말풍선 안에 [파일명 + 용량] + [56×56 파일타입 아이콘]을 배치하고,
 * 카드 전체를 클릭하면 presignedUrl로 다운로드/열기. hover 시 아이콘에 다운로드 오버레이.
 */
export function ChatFileCard({ file, disabled, highlightKeyword }: ChatFileCardProps) {
  const fileName = resolveFileName(file.path) || '파일';
  const sizeText = file.meta?.size ? formatBytes(file.meta.size, { fallback: '' }) : '';
  const href = file.presignedUrl || file.path;

  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 break-all text-sub-lg leading-snug text-gray-900">
          {renderHighlightedFileName(fileName, highlightKeyword)}
        </p>
        {sizeText && (
          <span className="flex items-center gap-1.5 text-sub-sm text-gray-700">
            <span>용량</span>
            <span>{sizeText}</span>
          </span>
        )}
      </div>

      <div className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-gray-100">
        <FileTypeIcon fileName={fileName} size={42} />
      </div>
    </>
  );

  // RN ChatFile 패리티 — 흰 카드 + gray-200 1px 테두리, 파일명 sub-lg(15)·용량 sub-sm(13)
  const cardClass = 'flex w-[248px] max-w-full items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5';

  if (disabled) {
    return <div className={cardClass}>{content}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className={`${cardClass} transition-colors hover:bg-gray-50`}
    >
      {content}
    </a>
  );
}

'use client';

import { FileTypeIcon } from '@/shared/ui/FileTypeIcon';
import { extractFileName, formatBytes } from '@/shared/utils/fileUtils';
import type { MessageFileItem } from '@/shared/types/websocket';

interface ChatFileCardProps {
  file: MessageFileItem;
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
export function ChatFileCard({ file }: ChatFileCardProps) {
  const fileName = resolveFileName(file.path) || '파일';
  const sizeText = file.meta?.size ? formatBytes(file.meta.size, { fallback: '' }) : '';
  const href = file.presignedUrl || file.path;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex w-[248px] max-w-full items-start gap-2.5 rounded-xl bg-white p-2.5 transition-colors hover:bg-gray-50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 break-all text-body leading-snug text-gray-900">{fileName}</p>
        {sizeText && (
          <span className="flex items-center gap-1.5 text-sub text-gray-700">
            <span>용량</span>
            <span>{sizeText}</span>
          </span>
        )}
      </div>

      <div className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-gray-100">
        <FileTypeIcon fileName={fileName} size={42} />
      </div>
    </a>
  );
}

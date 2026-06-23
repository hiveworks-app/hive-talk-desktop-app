'use client';

import type { ReactNode } from 'react';
import { ChatImageGrid } from '@/shared/ui/ChatImageGrid';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { UploadDimOverlay } from '@/shared/ui/UploadDimOverlay';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { URL_REGEX, normalizeUrl } from '@/shared/utils/linkPreview';
import { ChatFileCard } from './ChatFileCard';

/**
 * 텍스트 내 URL을 파란 밑줄 하이퍼링크로, 나머지는 일반 텍스트로 렌더한다.
 * (Figma 1317-31137 / 모바일 parseTextWithLinks 미러)
 */
function renderTextWithLinks(text: string): ReactNode {
  if (!text) return text;
  const matches = [...text.matchAll(new RegExp(URL_REGEX))];
  if (matches.length === 0) return text;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach((m, i) => {
    const url = m[0];
    const start = m.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    nodes.push(
      <a
        key={`link-${i}`}
        href={normalizeUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 underline"
        onClick={e => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  });
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

interface MessageContentProps {
  message: ChatMessageUI;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
}

export function MessageContent({ message, onOpenMedia }: MessageContentProps) {
  if (
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA
  ) {
    if (message.isLocal && message.localUris?.length) {
      const sources = message.localUris.map((uri, idx) => ({
        key: `local-${idx}`,
        src: uri,
      }));
      return (
        <div className="relative">
          <ChatImageGrid sources={sources} dimmed={message.dimmed} />
          <UploadDimOverlay fileId={message.fileId} dimmed={message.dimmed} />
        </div>
      );
    }

    const files = message.files ?? [];
    const sources = files.map((file, idx) => ({
      key: file.path || `file-${idx}`,
      src: file.meta?.thumbnailPresignedUrl || file.presignedUrl || file.path,
      storageKey: file.meta?.thumbnail || file.path,
      isVideo: file.meta?.type?.startsWith('video/'),
      duration: file.meta?.duration,
    }));
    const viewerItems: MediaViewerItem[] = files.map((file, idx) => ({
      id: file.path || `${message.id}-${idx}`,
      type: file.meta?.type?.startsWith('video/') ? 'video' as const : 'image' as const,
      url: file.presignedUrl || file.path,
      storageKey: file.path,
      author: message.name,
    }));

    return (
      <ChatImageGrid
        sources={sources}
        onImageClick={(clickedIndex) => onOpenMedia(viewerItems, clickedIndex)}
      />
    );
  }

  if (message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE) {
    return (
      <div className="flex flex-col gap-1">
        {message.files?.map((file, idx) => (
          <ChatFileCard key={file.path || idx} file={file} />
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{renderTextWithLinks(message.text)}</span>;
}

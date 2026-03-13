'use client';

import { ChatImageGrid } from '@/shared/ui/ChatImageGrid';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { UploadDimOverlay } from '@/shared/ui/UploadDimOverlay';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';

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
          <a
            key={idx}
            href={file.presignedUrl || file.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sub underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {file.path.split('/').pop() || '파일'}
          </a>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{message.text}</span>;
}

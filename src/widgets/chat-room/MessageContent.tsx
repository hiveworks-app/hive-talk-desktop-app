'use client';

import type { ReactNode } from 'react';
import { ChatImageGrid } from '@/shared/ui/ChatImageGrid';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { UploadDimOverlay } from '@/shared/ui/UploadDimOverlay';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { normalizeUrl } from '@/shared/utils/linkPreview';
import { parseTextWithLinks } from '@/shared/utils/parseTextWithLinks';
import { useUIStore } from '@/store/uiStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { ChatFileCard } from './ChatFileCard';
import { cancelMediaUpload } from '@/features/chat-room/useChatMediaUpload';
import { BUBBLE_TEXT_DISPLAY_SLICE_CHARS, BUBBLE_TEXT_TRUNCATE_CHARS, BUBBLE_TEXT_TRUNCATE_LINES } from '@/shared/config/constants';
import IconArrowRightDefault from '@assets/icons/arrow-right-default.svg';

/** 검색 키워드로 텍스트를 하이라이트 토큰으로 분리 (RN HighlightedText.splitByKeyword 패리티) */
function splitByKeyword(text: string, keyword: string) {
  const result: { text: string; isHighlight: boolean }[] = [];
  let remaining = text;
  let lowerRemaining = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  while (remaining.length > 0) {
    const index = lowerRemaining.indexOf(lowerKeyword);
    if (index === -1) {
      result.push({ text: remaining, isHighlight: false });
      break;
    }
    if (index > 0) {
      result.push({ text: remaining.slice(0, index), isHighlight: false });
    }
    result.push({ text: remaining.slice(index, index + lowerKeyword.length), isHighlight: true });
    remaining = remaining.slice(index + lowerKeyword.length);
    lowerRemaining = lowerRemaining.slice(index + lowerKeyword.length);
  }

  return result;
}

/** 키워드 매칭 글자에 노랑 하이라이트 적용 (RN brand-primary-300 #FFED66) */
function highlightText(text: string, keyword: string | null, keyPrefix: string): ReactNode {
  if (!keyword) return text;
  return splitByKeyword(text, keyword).map((part, i) =>
    part.isHighlight ? (
      <mark key={`${keyPrefix}-${i}`} className="rounded-sm bg-[#FFED66] text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

/** 전화번호 클릭 — 데스크톱은 다이얼러가 없어 복사 + 스낵바로 대응 (RN은 전화걸기/복사 액션시트) */
function copyPhoneNumber(phone: string) {
  navigator.clipboard.writeText(phone.replace(/[\s.]/g, ''));
  // RN 패리티 — 복사 스낵바 카피 통일
  useUIStore.getState().showSnackbar({ message: '복사되었습니다.', state: 'success' });
}

/**
 * 텍스트 내 URL/전화번호/이메일을 자동 링크로, 나머지는 일반 텍스트로 렌더한다.
 * (RN parseTextWithLinks 토크나이저 공유 — 국내 번호체계 화이트리스트 + 이메일)
 */
export function renderTextWithLinks(text: string, keyword: string | null = null): ReactNode {
  if (!text) return text;
  const tokens = parseTextWithLinks(text);
  if (tokens.length === 1 && tokens[0].type === 'text') {
    return highlightText(text, keyword, 'hl');
  }

  return tokens.map((token, i) => {
    if (token.type === 'link') {
      return (
        <a
          key={`link-${i}`}
          href={normalizeUrl(token.text)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
          onClick={e => e.stopPropagation()}
        >
          {highlightText(token.text, keyword, `hl-link-${i}`)}
        </a>
      );
    }
    if (token.type === 'email') {
      return (
        <a
          key={`email-${i}`}
          href={`mailto:${token.text}`}
          className="text-blue-500 underline"
          onClick={e => e.stopPropagation()}
        >
          {highlightText(token.text, keyword, `hl-email-${i}`)}
        </a>
      );
    }
    if (token.type === 'phone') {
      return (
        <button
          key={`phone-${i}`}
          type="button"
          className="text-blue-500 underline"
          onClick={e => {
            e.stopPropagation();
            copyPhoneNumber(token.text);
          }}
        >
          {highlightText(token.text, keyword, `hl-phone-${i}`)}
        </button>
      );
    }
    return highlightText(token.text, keyword, `hl-text-${i}`);
  });
}

interface MessageContentProps {
  /** 장문 접힘 '전체보기' 클릭 (RN ChatRoomFullMessageScreen 대응 — 데스크톱은 다이얼로그) */
  onExpandFullText?: (message: ChatMessageUI) => void;
  message: ChatMessageUI;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
}

export function MessageContent({ message, onOpenMedia, onExpandFullText }: MessageContentProps) {
  // 검색 하이라이트 키워드 — 검색 모드 + 확정 키워드가 있을 때만 (RN HighlightedText 패리티)
  const isSearchMode = useChatRoomRuntimeStore(s => s.isSearchMode);
  const activeSearchKeyword = useChatRoomRuntimeStore(s => s.activeSearchKeyword);
  const keyword = isSearchMode && activeSearchKeyword.trim() ? activeSearchKeyword : null;

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
          <UploadDimOverlay
            fileId={message.fileId}
            dimmed={message.dimmed}
            failed={message.localStatus === 'failed'}
            onCancel={message.localStatus === 'uploading' ? () => cancelMediaUpload(message.id) : undefined}
          />
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
      bundleId: message.id,
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
      // min-w-0 — 좁은 창에서 카드(max-w-full)가 컬럼 폭에 맞춰 줄어들 수 있게 flex 축소 허용
      <div className="relative flex min-w-0 flex-col gap-1">
        {message.files?.map((file, idx) => (
          // 로컬(업로드 중/실패) 파일은 다운로드 링크 비활성 — path가 파일명 placeholder라 링크가 죽은 참조
          <ChatFileCard key={file.path || idx} file={file} disabled={message.isLocal} highlightKeyword={keyword} />
        ))}
        {message.isLocal && (
          <UploadDimOverlay
            fileId={message.fileId}
            dimmed={message.dimmed}
            failed={message.localStatus === 'failed'}
            onCancel={message.localStatus === 'uploading' ? () => cancelMediaUpload(message.id) : undefined}
          />
        )}
      </div>
    );
  }

  // 장문 접힘 — 500자 이상 단일 조건 (RN MeBubble/UserBubble 패리티: >=500, 15줄은 접힘 시
  // 표시 상한일 뿐 트리거가 아니다. 줄수 트리거를 걸면 200자 30줄 메시지가 오접힘된다)
  const text = message.text ?? '';
  const textLines = text.split('\n');
  const isTruncated = text.length >= BUBBLE_TEXT_TRUNCATE_CHARS;
  if (isTruncated) {
    const lineLimited = textLines.slice(0, BUBBLE_TEXT_TRUNCATE_LINES).join('\n');
    const sliced = lineLimited.slice(0, BUBBLE_TEXT_DISPLAY_SLICE_CHARS);
    return (
      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {renderTextWithLinks(sliced, keyword)}
        <span className="text-text-tertiary">…</span>
        {/* RN 패리티 — 버블 전폭 justify-between, 본문색 유지, text-sub + → 화살표 */}
        {onExpandFullText && (
          <button
            type="button"
            onClick={() => onExpandFullText(message)}
            className="mt-1 flex w-full items-center justify-between text-sub font-medium text-gray-700 transition-opacity hover:opacity-70 active:opacity-60"
          >
            전체보기
            <IconArrowRightDefault width={16} height={16} />
          </button>
        )}
      </span>
    );
  }
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{renderTextWithLinks(text, keyword)}</span>;
}

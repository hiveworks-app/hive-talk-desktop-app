'use client';

import { memo, useCallback, useState } from 'react';
import {
  isFileNotice,
  isImageNotice,
  isMediaNotice,
  parseFileNoticeContent,
  parseMediaNoticeContent,
} from '@/features/chat-room/notice/noticeUtils';
import {
  useDeleteNoticeMutation,
  useNoticeQuery,
  useUpdateNoticeDisplayMutation,
} from '@/features/chat-room/notice/queries';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { IconDescription, IconPlay } from '@/shared/ui/icons';
import { formatBytes } from '@/shared/utils/fileUtils';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';

/* ── Material Design "campaign" 아이콘 (filled) ── */
const CampaignIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
  </svg>
);

const ChevronIcon = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    {up ? (
      <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
    ) : (
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
    )}
  </svg>
);

interface NoticeBannerProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
}

function NoticeBannerComponent({ roomId, channelType }: NoticeBannerProps) {
  const { data: notice } = useNoticeQuery(roomId, channelType);
  const currentUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const { mutate: deleteNotice } = useDeleteNoticeMutation(roomId, channelType);
  const { mutate: updateDisplay } = useUpdateNoticeDisplayMutation(roomId, channelType);

  // 접기/펼치기: 로컬 상태로 즉시 반응 (다시 안보기[DISMISSED]만 서버 영속)
  const [folded, setFolded] = useState(false);

  // 콘텐츠 타입 판별 + content 파싱 (notice 없으면 비활성)
  const imageNotice = !!notice && isImageNotice(notice);
  const mediaNotice = !!notice && isMediaNotice(notice);
  const fileNotice = !!notice && isFileNotice(notice);
  const isTextNotice = !!notice && !imageNotice && !mediaNotice && !fileNotice;
  const mediaParsed = mediaNotice && notice ? parseMediaNoticeContent(notice.content) : null;
  const fileParsed = fileNotice && notice ? parseFileNoticeContent(notice.content) : null;

  // presigned URL 해석 (hook은 무조건 호출, key null이면 disabled)
  const { data: imageUrl } = usePresignedUrl(imageNotice && notice ? notice.content : null);
  const { data: videoThumbUrl } = usePresignedUrl(mediaParsed?.thumbnailPath ?? null);
  const { data: videoUrl } = usePresignedUrl(mediaParsed?.videoPath ?? null);
  const { data: fileUrl } = usePresignedUrl(fileParsed?.filePath ?? null);

  const isOwner = !!notice && !!currentUserId && String(notice.userId) === String(currentUserId);
  const isEM = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE;

  const handleFold = useCallback(() => setFolded(true), []);
  const handleUnfold = useCallback(() => setFolded(false), []);

  const handleDelete = useCallback(() => {
    if (!notice) return;
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    deleteNotice(
      { noticeId: notice.noticeId },
      {
        onSuccess: () => showSnackbar({ message: '공지가 삭제되었습니다.' }),
        onError: () => showSnackbar({ message: '공지 삭제에 실패했습니다.', state: 'error' }),
      },
    );
  }, [notice, deleteNotice, showSnackbar]);

  const handleDismiss = useCallback(() => {
    if (!notice) return;
    // EM은 다시 안보기 미지원 (정책). DM/GM만 호출.
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'DISMISSED' } });
  }, [notice, updateDisplay]);

  if (!notice || notice.displayStatus === 'DISMISSED') return null;

  const previewText = imageNotice
    ? '사진이 공지로 등록되었어요.'
    : mediaNotice
      ? '영상이 공지로 등록되었어요.'
      : fileNotice
        ? '파일이 공지로 등록되었어요.'
        : notice.content;

  // 접힌 상태: 한 줄 요약
  if (folded) {
    return (
      <div className="flex w-full items-center gap-1.5 border-b border-divider bg-[#E6F3FF] px-4 py-2.5">
        <CampaignIcon size={16} className="shrink-0 text-[#007AFF]" />
        <span className="text-sub-sm font-semibold text-[#007AFF]">공지</span>
        <span className="flex-1 truncate text-sub-sm text-text-primary">{previewText}</span>
        <button
          onClick={handleUnfold}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
          aria-label="공지 펼치기"
        >
          <ChevronIcon />
        </button>
      </div>
    );
  }

  // 펼쳐진 상태
  return (
    <div className="border-b border-divider bg-[#E6F3FF] px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <CampaignIcon size={16} className="shrink-0 text-[#007AFF]" />
        <span className="flex-1 text-sub-sm font-semibold text-[#007AFF]">공지</span>
        {!isEM && (
          <button
            onClick={handleDismiss}
            className="rounded px-1.5 py-0.5 text-sub-sm text-text-secondary transition-colors hover:bg-[#C8E3FF]"
          >
            다시 안보기
          </button>
        )}
        <button
          onClick={handleFold}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
          aria-label="공지 접기"
        >
          <ChevronIcon up />
        </button>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
            aria-label="공지 삭제"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>

      {/* 콘텐츠 타입별 본문 */}
      {isTextNotice && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sub-sm text-text-primary">{notice.content}</p>
      )}

      {imageNotice && imageUrl && (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
          <img
            src={imageUrl}
            alt="공지 이미지"
            className="max-h-40 w-full rounded-lg object-cover"
          />
        </a>
      )}

      {mediaNotice && (
        <a
          href={videoUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-1.5 block"
        >
          {videoThumbUrl && (
            <img
              src={videoThumbUrl}
              alt="공지 동영상"
              className="max-h-40 w-full rounded-lg object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <IconPlay size={20} className="text-white" />
            </span>
          </span>
        </a>
      )}

      {fileNotice && fileParsed && (
        <a
          href={fileUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          download={fileParsed.fileName || undefined}
          className="mt-1.5 flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 transition-colors hover:bg-white"
        >
          <IconDescription size={20} className="shrink-0 text-[#007AFF]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sub-sm font-medium text-text-primary">{fileParsed.fileName || '파일'}</p>
            {fileParsed.fileSize > 0 && (
              <p className="text-[11px] text-text-tertiary">{formatBytes(fileParsed.fileSize)}</p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}

export const NoticeBanner = memo(NoticeBannerComponent);

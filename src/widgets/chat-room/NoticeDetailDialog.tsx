'use client';

import {
  isFileNotice,
  isImageNotice,
  isMediaNotice,
  parseFileNoticeContent,
  parseMediaNoticeContent,
} from '@/features/chat-room/notice/noticeUtils';
import type { NoticeModel } from '@/features/chat-room/notice/type';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { IconCampaign, IconDelete, IconDescription, IconPlay } from '@/shared/ui/icons';
import { formatBytes } from '@/shared/utils/fileUtils';
import { ProfileDialogShell } from '@/widgets/profile/ProfileDialogShell';

/** "2026년 4월 1일 오전 11시 06분 등록" 포맷 (Figma 공지 확인 1325-41751) */
function formatRegisteredAt(iso: string): string {
  const d = new Date(iso);
  const period = d.getHours() < 12 ? '오전' : '오후';
  const h = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${period} ${h}시 ${mm}분 등록`;
}

interface NoticeDetailDialogProps {
  notice: NoticeModel;
  creatorName: string;
  isOwner: boolean;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * 공지 확인 — 공지 배너를 눌렀을 때 본문 전체를 보는 모달.
 * 작성자/등록일시 + 본문(텍스트/이미지/영상/파일) + 삭제(작성자). (Figma 1325-41751)
 * 모달 배경이 테마 인식(bg-background)이므로 텍스트는 테마 토큰을 사용한다.
 */
export function NoticeDetailDialog({ notice, creatorName, isOwner, onDelete, onClose }: NoticeDetailDialogProps) {
  const imageNotice = isImageNotice(notice);
  const mediaNotice = isMediaNotice(notice);
  const fileNotice = isFileNotice(notice);
  const isTextNotice = !imageNotice && !mediaNotice && !fileNotice;
  const mediaParsed = mediaNotice ? parseMediaNoticeContent(notice.content) : null;
  const fileParsed = fileNotice ? parseFileNoticeContent(notice.content) : null;

  const { data: imageUrl } = usePresignedUrl(imageNotice ? notice.content : null);
  const { data: videoThumbUrl } = usePresignedUrl(mediaParsed?.thumbnailPath ?? null);
  const { data: videoUrl } = usePresignedUrl(mediaParsed?.videoPath ?? null);
  const { data: fileUrl } = usePresignedUrl(fileParsed?.filePath ?? null);

  return (
    <ProfileDialogShell title="공지 확인" onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-5 py-4">
        {/* 작성자 + 등록일시 (+ 작성자 본인이면 삭제) */}
        <div className="flex items-center gap-1.5">
          <IconCampaign size={24} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            {!!creatorName && (
              <p className="truncate text-label font-semibold text-text-primary">{creatorName}</p>
            )}
            <p className="text-sub text-text-secondary">{formatRegisteredAt(notice.createdAt)}</p>
          </div>
          {isOwner && (
            <button
              onClick={onDelete}
              aria-label="공지 삭제"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-pressed hover:text-text-secondary"
            >
              <IconDelete size={20} />
            </button>
          )}
        </div>

        {/* 본문 */}
        {isTextNotice && (
          <p className="whitespace-pre-wrap break-words text-body text-text-primary">{notice.content}</p>
        )}

        {imageNotice && imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
            <img src={imageUrl} alt="공지 이미지" className="w-full rounded-lg object-contain" />
          </a>
        )}

        {mediaNotice && (
          <a href={videoUrl || undefined} target="_blank" rel="noopener noreferrer" className="relative block">
            {videoThumbUrl && (
              <img src={videoThumbUrl} alt="공지 동영상" className="w-full rounded-lg object-cover" />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                <IconPlay size={24} className="text-white" />
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
            className="flex items-center gap-2 rounded-lg bg-surface-pressed px-3 py-2 transition-colors hover:opacity-80"
          >
            <IconDescription size={20} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sub font-medium text-text-primary">{fileParsed.fileName || '파일'}</p>
              {fileParsed.fileSize > 0 && (
                <p className="text-[11px] text-text-tertiary">{formatBytes(fileParsed.fileSize)}</p>
              )}
            </div>
          </a>
        )}
      </div>
    </ProfileDialogShell>
  );
}

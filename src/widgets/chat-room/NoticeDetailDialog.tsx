'use client';

import { useState } from 'react';
import {
  isFileNotice,
  isImageNotice,
  isMediaNotice,
  getFileNoticeInfo,
  isTextNotice as isTextNoticeGuard,
} from '@/features/chat-room/notice/noticeUtils';
import type { NoticeModel } from '@/features/chat-room/notice/type';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { IconPlay } from '@/shared/ui/icons';
import { IconNoticeDefault, IconOptionDelete } from '@assets/icons';
import { FileTypeIcon } from '@/shared/ui/FileTypeIcon';
import { renderTextWithLinks } from './MessageContent';
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

import { MediaViewer, type MediaViewerItem } from '@/shared/ui/MediaViewer';

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
  const textNotice = !imageNotice && !mediaNotice && !fileNotice;
  // v2: 미디어/파일 정보는 payload.path + payload.meta 에서 직접 (RN 패리티)
  const fileParsed = fileNotice ? getFileNoticeInfo(notice) : null;

  const { data: imageUrl } = usePresignedUrl(imageNotice ? notice.payload.path : null);
  const { data: videoThumbUrl } = usePresignedUrl(mediaNotice ? (notice.payload.meta?.thumbnail ?? null) : null);
  const { data: videoUrl } = usePresignedUrl(mediaNotice ? notice.payload.path : null);

  // 공지 첨부 인앱 프리뷰 (RN NoticeImagePreview/VideoPreview 대응 — 새 탭 대신 뷰어)
  const [previewItem, setPreviewItem] = useState<MediaViewerItem | null>(null);
  const { data: fileUrl } = usePresignedUrl(fileParsed?.filePath ?? null);

  return (
    <ProfileDialogShell title="공지 확인" onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-5 py-4">
        {/* 작성자 + 등록일시 (+ 작성자 본인이면 삭제) */}
        <div className="flex items-center gap-1.5">
          <IconNoticeDefault width={24} height={24} className="shrink-0" />
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-900 transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconOptionDelete width={24} height={24} />
            </button>
          )}
        </div>

        {/* 본문 */}
        {textNotice && isTextNoticeGuard(notice) && (
          <p className="whitespace-pre-wrap break-words text-body text-text-primary">{renderTextWithLinks(notice.payload.content)}</p>
        )}

        {imageNotice && imageUrl && (
          <button
            type="button"
            onClick={() =>
              setPreviewItem({
                id: notice.payload.path,
                type: 'image',
                url: imageUrl,
                storageKey: notice.payload.path,
                author: creatorName,
                createdAt: notice.createdAt,
              })
            }
            className="block w-full"
          >
            <img src={imageUrl} alt="공지 이미지" className="w-full rounded-xl object-contain" />
          </button>
        )}

        {mediaNotice && (
          <button
            type="button"
            onClick={() =>
              videoUrl &&
              setPreviewItem({
                id: notice.payload.path,
                type: 'video',
                url: videoUrl,
                storageKey: notice.payload.path,
                author: creatorName,
                createdAt: notice.createdAt,
                poster: videoThumbUrl ?? undefined,
              })
            }
            className="relative block w-full"
          >
            {videoThumbUrl && (
              <img src={videoThumbUrl} alt="공지 동영상" className="w-full rounded-xl object-cover" />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                <IconPlay size={24} className="text-white" />
              </span>
            </span>
          </button>
        )}

        {fileNotice && fileParsed && (
          <a
            href={fileUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            download={fileParsed.fileName || undefined}
            className="flex items-start gap-2 rounded-[10px] border border-gray-200 p-2.5 transition-opacity hover:opacity-80"
          >
            {/* RN 패리티 — 확장자 아이콘 28 + 파일명 2줄 + 용량 */}
            <FileTypeIcon fileName={fileParsed.fileName || '파일'} size={28} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-all text-sub text-text-primary">{fileParsed.fileName || '파일'}</p>
              {fileParsed.fileSize > 0 && (
                <p className="text-sub text-text-secondary">{formatBytes(fileParsed.fileSize)}</p>
              )}
            </div>
          </a>
        )}
      </div>

      {/* 첨부 인앱 뷰어 (줌·다운로드 — 채팅방 뷰어 재사용) */}
      {previewItem && (
        <MediaViewer
          visible
          items={[previewItem]}
          currentIndex={0}
          onIndexChange={() => {}}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </ProfileDialogShell>
  );
}

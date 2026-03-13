'use client';

import { memo, useCallback, useState } from 'react';
import {
  useDeleteNoticeMutation,
  useNoticeQuery,
} from '@/features/chat-room/notice/queries';
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';

/* ── Material Design "campaign" 아이콘 (filled) ── */
const CampaignIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
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

  const isOwner = !!notice && !!currentUserId && String(notice.userId) === String(currentUserId);

  // 접기/펼치기: 로컬 상태로 즉시 반응
  const [folded, setFolded] = useState(false);

  const handleFold = useCallback(() => setFolded(true), []);
  const handleUnfold = useCallback(() => setFolded(false), []);

  const handleDelete = useCallback(() => {
    if (!notice) return;
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    deleteNotice(
      { noticeId: notice.noticeId },
      {
        onSuccess: () => {
          showSnackbar({ message: '공지가 삭제되었습니다.' });
        },
        onError: () => {
          showSnackbar({ message: '공지 삭제에 실패했습니다.', state: 'error' });
        },
      },
    );
  }, [notice, deleteNotice, showSnackbar]);

  if (!notice || notice.displayStatus === 'DISMISSED') return null;

  // 접힌 상태: 한 줄 요약
  if (folded) {
    return (
      <div className="flex w-full items-center gap-1.5 border-b border-divider bg-[#E6F3FF] px-4 py-2.5">
        <CampaignIcon size={16} className="shrink-0 text-[#007AFF]" />
        <span className="text-sub-sm font-semibold text-[#007AFF]">공지</span>
        <span className="flex-1 truncate text-sub-sm text-text-primary">{notice.content}</span>
        {/* keyboard_arrow_down (펼치기) */}
        <button
          onClick={handleUnfold}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>
    );
  }

  // 펼쳐진 상태: 전체 내용
  return (
    <div className="border-b border-divider bg-[#E6F3FF] px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <CampaignIcon size={16} className="shrink-0 text-[#007AFF]" />
        <span className="flex-1 text-sub-sm font-semibold text-[#007AFF]">공지</span>
        {/* keyboard_arrow_up (접기) */}
        <button
          onClick={handleFold}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        {/* close (삭제) - 작성자만 */}
        {isOwner && (
          <button
            onClick={handleDelete}
            className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-[#C8E3FF]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-1 text-sub-sm text-text-primary">{notice.content}</p>
    </div>
  );
}

export const NoticeBanner = memo(NoticeBannerComponent);

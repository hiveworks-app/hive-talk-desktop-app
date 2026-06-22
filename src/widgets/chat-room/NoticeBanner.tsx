'use client';

import { memo, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  isFileNotice,
  isImageNotice,
  isMediaNotice,
  parseMediaNoticeContent,
} from '@/features/chat-room/notice/noticeUtils';
import {
  useDeleteNoticeMutation,
  useNoticeQuery,
  useUpdateNoticeDisplayMutation,
} from '@/features/chat-room/notice/queries';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { cn } from '@/shared/lib/cn';
import type { ParticipantItemsType } from '@/shared/types/chatRoom';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { IconCampaign, IconPlay } from '@/shared/ui/icons';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import { NoticeDetailDialog } from './NoticeDetailDialog';

const ChevronIcon = ({ up, className }: { up?: boolean; className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={className}>
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

// 흰 카드 + section-shadow (Figma 1334-34203/42082). chat-bg 위에 떠 있어 색은 고정값 사용.
const CARD = 'rounded-[10px] bg-white shadow-[0px_2px_9px_0px_rgba(0,0,0,0.07)]';
const PILL_BTN =
  'h-10 flex-1 rounded-md bg-blue-100 text-sub font-medium text-blue-500 transition-opacity hover:opacity-80';

function NoticeBannerComponent({ roomId, channelType }: NoticeBannerProps) {
  const { data: notice } = useNoticeQuery(roomId, channelType);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const { mutate: deleteNotice } = useDeleteNoticeMutation(roomId, channelType);
  const { mutate: updateDisplay } = useUpdateNoticeDisplayMutation(roomId, channelType);

  const [isExpanded, setIsExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // 콘텐츠 타입 + 미디어 썸네일 presigned (hook은 무조건 호출, key null이면 disabled)
  const imageNotice = !!notice && isImageNotice(notice);
  const mediaNotice = !!notice && isMediaNotice(notice);
  const fileNotice = !!notice && isFileNotice(notice);
  const mediaParsed = mediaNotice && notice ? parseMediaNoticeContent(notice.content) : null;
  const { data: imageUrl } = usePresignedUrl(imageNotice && notice ? notice.content : null);
  const { data: videoThumbUrl } = usePresignedUrl(mediaParsed?.thumbnailPath ?? null);

  const isOwner = !!notice && !!currentUserId && String(notice.userId) === String(currentUserId);
  const isEM = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE;

  // 참여자 캐시에서 등록자 이름 조회 (추가 네트워크 요청 없음 — RN 패리티)
  const creatorName = (() => {
    if (!notice) return '';
    const participants = queryClient.getQueryData<ParticipantItemsType[]>(
      ROOM_PARTICIPANTS_KEY(roomId, channelType),
    );
    return participants?.find(p => String(p.userId) === String(notice.userId))?.name ?? '';
  })();

  const handleDismiss = useCallback(() => {
    if (!notice) return;
    // EM은 다시 안보기(DISMISSED) 미지원 → 접어두기(FOLDED)로 대체 (정책)
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: isEM ? 'FOLDED' : 'DISMISSED' } });
  }, [notice, isEM, updateDisplay]);

  const handleFold = useCallback(() => {
    if (!notice) return;
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'FOLDED' } });
  }, [notice, updateDisplay]);

  const handleRestore = useCallback(() => {
    if (!notice) return;
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'VISIBLE' } });
  }, [notice, updateDisplay]);

  const handleDelete = useCallback(() => {
    if (!notice) return;
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    deleteNotice(
      { noticeId: notice.noticeId },
      {
        onSuccess: () => {
          setDetailOpen(false);
          showSnackbar({ message: '공지가 삭제되었습니다.' });
        },
        onError: () => showSnackbar({ message: '공지 삭제에 실패했습니다.', state: 'error' }),
      },
    );
  }, [notice, deleteNotice, showSnackbar]);

  if (!notice || notice.displayStatus === 'DISMISSED') return null;

  const previewText = imageNotice
    ? '사진이 공지로 등록되었어요.'
    : mediaNotice
      ? '영상이 공지로 등록되었어요.'
      : fileNotice
        ? '파일이 공지로 등록되었어요.'
        : notice.content;

  const detailDialog = detailOpen && (
    <NoticeDetailDialog
      notice={notice}
      creatorName={creatorName}
      isOwner={isOwner}
      onDelete={handleDelete}
      onClose={() => setDetailOpen(false)}
    />
  );

  // ── FOLDED: 우측 작은 메가폰 아이콘만 (탭 시 복원) ──
  if (notice.displayStatus === 'FOLDED') {
    return (
      <div className="flex justify-end bg-chat-bg px-4 py-2">
        <button
          onClick={handleRestore}
          aria-label="공지 펼치기"
          className={cn('flex items-center justify-center p-2.5', CARD)}
        >
          <IconCampaign size={24} className="text-blue-500" />
        </button>
        {detailDialog}
      </div>
    );
  }

  // ── 접힘(collapsed): 메가폰 + 2줄 미리보기 + 펼침 ▾ ──
  if (!isExpanded) {
    return (
      <div className="bg-chat-bg px-4 py-2">
        <div className={cn('flex items-start gap-1 p-2.5', CARD)}>
          <button
            onClick={() => setDetailOpen(true)}
            className="flex min-w-0 flex-1 items-start gap-1 text-left"
          >
            <IconCampaign size={24} className="shrink-0 text-blue-500" />
            <span className="line-clamp-2 flex-1 text-sub font-medium text-gray-900">{previewText}</span>
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            aria-label="공지 펼치기"
            className="shrink-0 text-gray-600 transition-opacity hover:opacity-70"
          >
            <ChevronIcon />
          </button>
        </div>
        {detailDialog}
      </div>
    );
  }

  // ── 펼침(expanded): + 작성자 + 접기 ▴ + [다시 안보기][접어두기] ──
  return (
    <div className="bg-chat-bg px-4 py-2">
      <div className={cn('flex flex-col gap-1.5 p-2.5', CARD)}>
        <div className="flex items-start gap-1.5">
          <button
            onClick={() => setDetailOpen(true)}
            className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          >
            <IconCampaign size={24} className="shrink-0 text-blue-500" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sub font-medium text-gray-900">{previewText}</span>
              {!imageNotice && !mediaNotice && !!creatorName && (
                <span className="mt-1 block text-sub-sm text-gray-600">{creatorName}</span>
              )}
            </span>
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            aria-label="공지 접기"
            className="shrink-0 text-gray-600 transition-opacity hover:opacity-70"
          >
            <ChevronIcon up />
          </button>
        </div>

        {/* 이미지/영상 공지: 썸네일 (탭 시 상세) */}
        {imageNotice && imageUrl && (
          <button onClick={() => setDetailOpen(true)} className="block w-full">
            <img src={imageUrl} alt="공지 이미지" className="max-h-40 w-full rounded-lg object-cover" />
            {!!creatorName && <span className="mt-1 block text-left text-sub-sm text-gray-600">{creatorName}</span>}
          </button>
        )}
        {mediaNotice && (
          <button onClick={() => setDetailOpen(true)} className="block w-full text-left">
            <span className="relative block">
              {videoThumbUrl && (
                <img src={videoThumbUrl} alt="공지 동영상" className="max-h-40 w-full rounded-lg object-cover" />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                  <IconPlay size={20} className="text-white" />
                </span>
              </span>
            </span>
            {!!creatorName && <span className="mt-1 block text-sub-sm text-gray-600">{creatorName}</span>}
          </button>
        )}

        {/* 액션 버튼 (EM은 다시 안보기 미제공) */}
        <div className="flex gap-2">
          {!isEM && (
            <button onClick={handleDismiss} className={PILL_BTN}>
              다시 안보기
            </button>
          )}
          <button onClick={handleFold} className={PILL_BTN}>
            접어두기
          </button>
        </div>
      </div>
      {detailDialog}
    </div>
  );
}

export const NoticeBanner = memo(NoticeBannerComponent);

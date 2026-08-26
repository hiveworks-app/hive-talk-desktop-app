'use client';

import { memo, useCallback, useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  isFileNotice,
  isImageNotice,
  isMediaNotice,
  isTextNotice,
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
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { IconPlay } from '@/shared/ui/icons';
import { IconNoticeDefault, IconNoticeNew } from '@assets/icons';
import { renderTextWithLinks } from './MessageContent';
import { useNoticeReadStore } from '@/store/chat/noticeReadStore';
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
const CARD = 'rounded-[10px] bg-white shadow-[0px_2px_10px_0px_rgba(0,0,0,0.12)]'; // RN noticeBannerShadow 0.12/10
const PILL_BTN =
  'h-10 flex-1 rounded-md bg-blue-100 text-sub font-medium text-blue-500 transition-opacity hover:opacity-80';

function NoticeBannerComponent({ roomId, channelType }: NoticeBannerProps) {
  const { data: notice } = useNoticeQuery(roomId, channelType);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore(s => s.user?.id);
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const { mutate: deleteNotice } = useDeleteNoticeMutation(roomId, channelType);
  const { mutate: updateDisplay } = useUpdateNoticeDisplayMutation(roomId, channelType);

  // 펼침 상태는 noticeId에 귀속 — 새 공지로 교체되면 자동으로 접힌다 (RN expandedNoticeId 패리티)
  const [expandedNoticeId, setExpandedNoticeId] = useState<number | null>(null);
  const isExpanded = notice ? expandedNoticeId === notice.noticeId : false;
  const [detailOpen, setDetailOpen] = useState(false);

  // 공지 읽음 dot — 미확인 공지는 빨간 dot 아이콘, 상세 열람 시 읽음 처리 (RN 패리티)
  const markNoticeAsRead = useNoticeReadStore(s => s.markNoticeAsRead);
  const readNoticeId = useNoticeReadStore(s =>
    currentUserId && notice
      ? s.readNoticeByRoom[`${String(currentUserId)}:${channelType}:${roomId}`]
      : undefined,
  );
  const isCurrentNoticeRead = notice ? readNoticeId === notice.noticeId : false;
  const NoticeIcon = isCurrentNoticeRead ? IconNoticeDefault : IconNoticeNew;
  const openDetail = () => {
    if (notice && currentUserId) {
      markNoticeAsRead({
        userId: String(currentUserId),
        roomId,
        channelType,
        noticeId: notice.noticeId,
      });
    }
    setDetailOpen(true);
  };

  // 콘텐츠 타입 + 미디어 썸네일 presigned (hook은 무조건 호출, key null이면 disabled)
  const imageNotice = !!notice && isImageNotice(notice);
  const mediaNotice = !!notice && isMediaNotice(notice);
  const fileNotice = !!notice && isFileNotice(notice);
  const textNotice = !!notice && isTextNotice(notice);
  const { data: imageUrl } = usePresignedUrl(imageNotice && notice ? notice.payload.path : null);
  const { data: videoThumbUrl } = usePresignedUrl(
    mediaNotice && notice ? (notice.payload.meta?.thumbnail ?? null) : null,
  );

  const isOwner = !!notice && !!currentUserId && String(notice.userId) === String(currentUserId);

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
    // 다시 안보기(DISMISSED) — EM 포함 전 채널 지원 (RN 7/1 정책 변경)
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'DISMISSED' } });
  }, [notice, updateDisplay]);

  const handleFold = useCallback(() => {
    if (!notice) return;
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'FOLDED' } });
  }, [notice, updateDisplay]);

  const handleRestore = useCallback(() => {
    if (!notice) return;
    updateDisplay({ noticeId: notice.noticeId, body: { displayStatus: 'VISIBLE' } });
  }, [notice, updateDisplay]);

  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const handleDelete = useCallback(() => {
    if (!notice) return;
    setDeleteConfirmOpen(true);
  }, [notice]);
  const confirmDelete = useCallback(() => {
    if (!notice) return;
    setDeleteConfirmOpen(false);
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
        : isTextNotice(notice) ? notice.payload.content : '';

  // 공지 삭제 확인 — window.confirm 대체 (RN showConfirm 패리티)
  const deleteConfirmDialog = (
    <ConfirmDialog
      open={isDeleteConfirmOpen}
      title="공지를 내릴까요?"
      description="채팅방 상단 공지가 삭제됩니다."
      confirmLabel="공지 내리기"
      cancelLabel="취소"
      destructive
      onConfirm={confirmDelete}
      onCancel={() => setDeleteConfirmOpen(false)}
    />
  );

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
          <NoticeIcon width={24} height={24} />
        </button>
        {detailDialog}
        {deleteConfirmDialog}
      </div>
    );
  }

  // ── 접힘(collapsed): 메가폰 + 2줄 미리보기 + 펼침 ▾ ──
  if (!isExpanded) {
    return (
      <div className="bg-chat-bg px-4 py-2">
        <div className={cn('flex items-start gap-1 p-2.5', CARD)}>
          <button
            onClick={openDetail}
            className="flex min-w-0 flex-1 items-start gap-1 text-left"
          >
            <NoticeIcon width={24} height={24} className="shrink-0" />
            {/* min-h-6(아이콘 높이) + 세로 중앙 — 1줄이면 아이콘과 수직 중앙, 2줄이면 상단 정렬 (RN 패리티) */}
            <span className="flex min-h-6 min-w-0 flex-1 flex-col justify-center">
              <span className="line-clamp-2 text-sub font-medium text-gray-900">{textNotice ? renderTextWithLinks(previewText) : previewText}</span>
            </span>
          </button>
          <button
            onClick={() => setExpandedNoticeId(notice.noticeId)}
            aria-label="공지 펼치기"
            className="flex h-6 shrink-0 items-center justify-center text-gray-600 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <ChevronIcon />
          </button>
        </div>
        {detailDialog}
        {deleteConfirmDialog}
      </div>
    );
  }

  // ── 펼침(expanded): + 작성자 + 접기 ▴ + [다시 안보기][접어두기] ──
  return (
    <div className="bg-chat-bg px-4 py-2">
      <div className={cn('flex flex-col gap-1.5 p-2.5', CARD)}>
        <div className="flex items-start gap-1.5">
          <button
            onClick={openDetail}
            className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          >
            <NoticeIcon width={24} height={24} className="shrink-0" />
            <span className="flex min-h-6 min-w-0 flex-1 flex-col justify-center">
              <span className="line-clamp-3 text-sub font-medium text-gray-900">{textNotice ? renderTextWithLinks(previewText) : previewText}</span>
              {!imageNotice && !mediaNotice && !!creatorName && (
                <span className="mt-1 block text-sub-sm text-gray-600">{creatorName}</span>
              )}
            </span>
          </button>
          <button
            onClick={() => setExpandedNoticeId(null)}
            aria-label="공지 접기"
            className="flex h-6 shrink-0 items-center justify-center text-gray-600 transition-opacity hover:opacity-70 active:opacity-60"
          >
            <ChevronIcon up />
          </button>
        </div>

        {/* 이미지/영상 공지: 썸네일 (탭 시 상세) */}
        {imageNotice && imageUrl && (
          <button onClick={openDetail} className="block w-full px-2.5">
            {/* RN 패리티 — h-148 고정 · rounded-xl · black/10 플레이스홀더 박스 */}
            <span className="block h-[148px] w-full overflow-hidden rounded-xl bg-black/10">
              <img src={imageUrl} alt="공지 이미지" className="h-full w-full object-cover" />
            </span>
            {!!creatorName && <span className="mt-1 block text-left text-sub-sm text-gray-600">{creatorName}</span>}
          </button>
        )}
        {mediaNotice && (
          <button onClick={openDetail} className="block w-full px-2.5 text-left">
            <span className="relative block h-[148px] w-full overflow-hidden rounded-xl bg-black/10">
              {videoThumbUrl && (
                <img src={videoThumbUrl} alt="공지 동영상" className="h-full w-full object-cover" />
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

        {/* 액션 버튼 — 다시 안보기는 EM 포함 전 채널 노출 (RN 7/1 정책 변경) */}
        <div className="flex gap-2">
          <button onClick={handleDismiss} className={PILL_BTN}>
            다시 안보기
          </button>
          <button onClick={handleFold} className={PILL_BTN}>
            접어두기
          </button>
        </div>
      </div>
      {detailDialog}
      {deleteConfirmDialog}
    </div>
  );
}

export const NoticeBanner = memo(NoticeBannerComponent);

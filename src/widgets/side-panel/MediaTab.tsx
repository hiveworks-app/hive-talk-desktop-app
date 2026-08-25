'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFilesInfiniteQuery, getSidePanelBeforeAttachmentQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { cn } from '@/shared/lib/cn';
import { IconDownload, IconPlay } from '@/shared/ui/icons';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import { Spinner } from '@/shared/ui/Spinner';
import type { MediaListType } from '@/shared/types/media';
import type { FileSenderItem } from '@/features/chat-room-side-panel/type';
import { WS_MESSAGE_CONTENT_TYPE, type WebSocketChannelTypes } from '@/shared/types/websocket';
import { formatMediaDuration } from '@/shared/utils/formatTimeUtils';
import { isBlockedUser } from '@/store/blockedMembersStore';
import { bundleMediaByMessage, formatSizeParts, groupByDate } from '@/shared/utils/chatSidePanelUtils';
import IconBlock from '@assets/icons/block.svg';
import { IconBundleImage, IconCheck } from '@assets/icons';
import { SenderSearchBar } from './SenderSearchBar';
import { useSidePanelMediaViewer } from './useSidePanelMediaViewer';

interface MediaTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

/** 저장 파일명 — 서버 저장 키(UUID)가 아니라 읽을 수 있는 이름으로 (카톡 PC 관례, 전송 시각 기준).
 *  같은 초에 여러 장이면 main의 uniqueSavePath가 " (1)"을 붙여 회피한다. */
const mediaSaveName = (media: MediaListType) => {
  const ext =
    media.path.match(/\.\w+$/)?.[0] ??
    (media.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ? '.mp4' : '.jpg');
  const d = new Date(media.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `HiveTalk_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ext}`;
};

export function MediaTab({ roomId, channelType, lastMessageId }: MediaTabProps) {
  // 보낸사람 필터 — RN처럼 단일 선택(칩 1개), 서버(GET /app/chat/files)에서 처리. 없으면 base 캐시
  const [selectedSender, setSelectedSender] = useState<FileSenderItem | null>(null);
  const senderIds = selectedSender ? [String(selectedSender.userId)] : [];
  const isFilterMode = senderIds.length > 0;
  const baseQuery = useInfiniteQuery({
    ...getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
    enabled: !isFilterMode,
  });
  const filterQuery = useInfiniteQuery({
    ...getFilesInfiniteQuery({
      roomId,
      channelType,
      contentType: ['IMAGE', 'MEDIA'],
      senders: senderIds,
    }),
    enabled: isFilterMode,
  });
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = isFilterMode
    ? filterQuery
    : baseQuery;

  const { download, downloadingId, downloadMany, bulkDownloading } = useFileDownload();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allMedia: MediaListType[] = data?.pages.flatMap(p => p.items) ?? [];
  const totalItems = data?.pages[0]?.pagination.totalItems ?? 0;
  const totalFileSize = data?.pages[0]?.totalFileSize ?? 0;
  const filtered = allMedia;

  const viewer = useSidePanelMediaViewer(filtered);

  // RN 패리티 — 미디어 탭만 messageId 묶음(대표 1장 + 배지) 후 날짜별 그룹 (파일 탭은 평면 유지 규칙)
  const bundled = bundleMediaByMessage(filtered);
  const grouped = groupByDate(bundled);

  // 선택 토글·카운트는 묶음 단위 (RN SidePanelSelectItem 패리티)
  const toggleBundle = (ids: string[]) =>
    setSelected(prev => {
      const next = new Set(prev);
      const wasAll = ids.every(id => next.has(id));
      ids.forEach(id => (wasAll ? next.delete(id) : next.add(id)));
      return next;
    });
  const selectedBundleCount = bundled.reduce(
    (n, b) => (b.bundleItemIds.every(id => selected.has(id)) ? n + 1 : n),
    0,
  );
  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    setSelected(new Set());
  };
  const handleBulkDownload = () => {
    const items = filtered
      .filter(m => selected.has(m.id))
      .map(m => ({ url: m.presignedUrl, storageKey: m.path, filename: mediaSaveName(m) }));
    downloadMany(items);
  };

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  if (allMedia.length === 0 && !isFilterMode) {
    return <div className="px-4 py-8 text-center text-sub-sm text-text-tertiary">사진/동영상이 없어요.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 보낸사람 검색 줄 (RN 검색 모드 패리티 — 드롭다운 + 칩 단일 선택) */}
      <div className="sticky top-0 z-10">
        <SenderSearchBar
          roomId={roomId}
          channelType={channelType}
          contentType={['IMAGE', 'MEDIA']}
          selectedSender={selectedSender}
          onChange={setSelectedSender}
        />
      </div>

      {/* 총 N개 · 용량 · [선택/선택해제] (RN SidePanelSelectItemTitle 패리티) */}
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-1 text-sub text-gray-700">
          <span>총</span>
          <span className="font-medium text-black">{totalItems}</span>
          <span>개</span>
        </div>
        <div className="flex flex-1 items-center text-sub">
          <span className="font-medium text-text-secondary">{formatSizeParts(totalFileSize).value}</span>
          <span className="text-text-tertiary">{formatSizeParts(totalFileSize).unit}</span>
        </div>
        <button
          type="button"
          onClick={toggleSelectMode}
          disabled={bundled.length === 0}
          className={cn(
            'flex h-8 items-center justify-center gap-0.5 rounded-md border bg-white px-2 text-sub font-medium',
            bundled.length === 0
              ? 'border-gray-200 text-gray-400 opacity-50'
              : selectMode
                ? 'border-gray-200 text-text-primary'
                : 'border-primary text-primary',
          )}
        >
          {!selectMode && <IconCheck width={16} height={11} />}
          {selectMode ? (selectedBundleCount > 0 ? `${selectedBundleCount} 선택해제` : '선택해제') : '선택'}
        </button>
      </div>

      <div className="flex-1 py-2">
        {bundled.length === 0 ? (
          <div className="py-8 text-center text-sub-sm text-text-tertiary">사진/동영상이 없어요.</div>
        ) : (
          /* RN 패리티 — 날짜 헤더(px-4) 아래 full-width 그리드 */
          grouped.map(group => (
            <div key={group.date} className="mb-2.5">
              <p className="mb-2.5 px-4 text-sub text-text-primary">{group.date}</p>
              <div className="grid grid-cols-3 gap-1">
                {group.items.map(media => {
                  const fileName = mediaSaveName(media);
                  const isChecked = media.bundleItemIds.every(id => selected.has(id));
                  const isBundle = media.bundleCount > 1;
                  const isBlocked = !!media.senderId && isBlockedUser(String(media.senderId));
                  const isVideo = media.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA;
                  const thumb = (
                    <img
                      src={media.thumbnailPresignedUrl || media.presignedUrl || media.path}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  );
                  return (
                    <div key={media.id} className="group relative aspect-square overflow-hidden rounded bg-gray-100">
                      {/* 썸네일 탭 = 선택 모드에서도 뷰어 (RN 동일 — 선택은 체크박스로만) */}
                      <button
                        type="button"
                        onClick={() => viewer.open(filtered.findIndex(m => m.id === media.id))}
                        className="block h-full w-full"
                      >
                        {thumb}
                      </button>
                      {!selectMode && (
                        <button
                          type="button"
                          onClick={() => download(media.id, media.presignedUrl, fileName, media.path)}
                          disabled={downloadingId === media.id}
                          className="absolute right-1 top-1 hidden rounded-full bg-black/55 p-1.5 text-white transition-colors hover:bg-black/75 group-hover:flex disabled:opacity-50"
                          aria-label="다운로드"
                        >
                          <IconDownload size={14} />
                        </button>
                      )}
                      {isVideo && !isBundle && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                            <IconPlay size={14} />
                          </span>
                        </span>
                      )}
                      {isVideo && !isBundle && formatMediaDuration(media.duration) && (
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                          {formatMediaDuration(media.duration)}
                        </span>
                      )}
                      {/* 같은 메시지로 보낸 묶음 — 대표 1장 + 묶음 배지 (RN SidePanelMediaThumb 패리티) */}
                      {isBundle && (
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-md bg-black/30 text-white">
                          <IconBundleImage width={18} height={16} />
                        </span>
                      )}
                      {/* 차단 발신자 리소스 가림 (RN Figma 3145:66586) — 클릭은 그대로 허용 */}
                      {isBlocked && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
                          <IconBlock width={18} height={18} className="text-gray-500" />
                        </span>
                      )}
                      {/* 우상단 24px 체크박스 — 묶음 단위 토글 (RN SidePanelMediaThumb selectable 패리티) */}
                      {selectMode && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleBundle(media.bundleItemIds);
                          }}
                          className={cn(
                            'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border',
                            isChecked ? 'border-primary bg-primary' : 'border-gray-300 bg-white',
                          )}
                          aria-label={isChecked ? '선택 해제' : '선택'}
                        >
                          {isChecked && <IconCheck width={16} height={11} className="text-on-primary" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-2 w-full py-2 text-sub-sm text-primary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-50"
          >
            {isFetchingNextPage ? '로딩 중...' : '더 보기'}
          </button>
        )}
      </div>

      {/* 선택 모드 하단 일괄 다운로드 바 — 0개면 회색 비활성 (RN SidePanelSelectItemDownload 패리티) */}
      {selectMode && (
        <div className="sticky bottom-0 border-t border-divider bg-background p-3">
          <button
            type="button"
            onClick={handleBulkDownload}
            disabled={bulkDownloading || selected.size === 0}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-body font-medium text-white',
              selected.size === 0 ? 'bg-gray-400' : 'bg-primary',
            )}
          >
            {bulkDownloading ? <Spinner /> : <IconDownload size={16} />}
            {bulkDownloading ? '다운로드 중...' : '사진/동영상 다운로드'}
          </button>
        </div>
      )}

      <MediaViewer
        visible={viewer.visible}
        items={viewer.items}
        currentIndex={viewer.index}
        onIndexChange={viewer.setIndex}
        onClose={viewer.close}
      />
    </div>
  );
}

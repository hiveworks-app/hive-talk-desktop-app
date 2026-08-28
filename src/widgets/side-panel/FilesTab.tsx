'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFilesInfiniteQuery, getSidePanelBeforeFileQuery } from '@/features/chat-room-side-panel/queries';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { cn } from '@/shared/lib/cn';
import { IconDownload } from '@/shared/ui/icons';
import { Spinner } from '@/shared/ui/Spinner';
import { formatBytes } from '@/shared/utils/fileUtils';
import { FileTypeIcon } from '@/shared/ui/FileTypeIcon';
import { PresignedImage } from '@/shared/ui/PresignedImage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { isBlockedUser } from '@/store/blockedMembersStore';
import { formatSizeParts, groupByDate } from '@/shared/utils/chatSidePanelUtils';
import IconBlock from '@assets/icons/block.svg';
import { IconCheck } from '@assets/icons';
import { SenderSearchBar } from './SenderSearchBar';
import type { MediaListType } from '@/shared/types/media';
import type { FileSenderItem } from '@/features/chat-room-side-panel/type';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

interface FilesTabProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
  /** 현재 표시 중인 탭인지 — 탭 이탈 시 선택 모드 해제 (RN 탭 전환 리셋 패리티) */
  active: boolean;
  /** 보낸사람 필터 — 보관함 레벨 공유 상태 (탭 전환에도 유지, RN 화면 레벨 패리티) */
  selectedSender: FileSenderItem | null;
  onSenderChange: (sender: FileSenderItem | null) => void;
}

const fileNameOf = (file: MediaListType) => file.path.split('/').pop() || '파일';

export function FilesTab({ roomId, channelType, lastMessageId, active, selectedSender, onSenderChange }: FilesTabProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // 보낸사람 필터 — RN처럼 단일 선택(칩 1개). 칩과 키워드는 공존하지 않는다
  // (타이핑 시작 시 SenderSearchBar가 칩을 제거 — RN 동일)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250); // RN KEYWORD_DEBOUNCE_MS 동일
    return () => clearTimeout(t);
  }, [query]);

  // 파일명/보낸사람 필터는 서버(GET /app/chat/files)에서 처리 (RN 패리티) —
  // 필터가 없으면 base 캐시(사이드패널 진입 시 목록)를 그대로 사용.
  // 키워드는 칩이 없을 때만 파일명 필터로 작동 (RN — 칩이 주된 필터)
  const senderIds = selectedSender ? [String(selectedSender.userId)] : [];
  const effectiveFileName = selectedSender ? '' : debouncedQuery;
  const isFilterMode = senderIds.length > 0 || effectiveFileName.length > 0;
  const baseQuery = useInfiniteQuery({
    ...getSidePanelBeforeFileQuery(roomId, lastMessageId, channelType),
    enabled: !isFilterMode,
  });
  const filterQuery = useInfiniteQuery({
    ...getFilesInfiniteQuery({
      roomId,
      channelType,
      contentType: ['FILE'],
      senders: senderIds,
      fileName: effectiveFileName,
    }),
    enabled: isFilterMode,
  });
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = isFilterMode
    ? filterQuery
    : baseQuery;

  const { download, downloadingId, downloadMany, bulkDownloading } = useFileDownload();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 탭 이탈 시 선택 모드 해제 + 선택 초기화 — RN handleTypeChange의 setIsSelectMode(false) 패리티.
  // 검색어·필터는 유지 (RN도 선택 상태만 리셋). 렌더 중 상태 보정 패턴 (ChatInput 방 전환과 동일)
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      setSelectMode(false);
      setSelected(new Set());
    }
  }

  const allFiles: MediaListType[] = data?.pages.flatMap(p => p.items) ?? [];
  const q = effectiveFileName.toLowerCase(); // 파일명 하이라이트는 실제 필터 중일 때만
  const filtered = allFiles;
  // 서버가 dataset 전체 totals를 매 페이지 반환 — "총 N개 · 용량" 헤더 (RN 패리티)
  const totalItems = data?.pages[0]?.pagination.totalItems ?? 0;
  const totalFileSize = data?.pages[0]?.totalFileSize ?? 0;

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    setSelected(new Set());
  };
  const handleBulkDownload = () => {
    const items = filtered
      .filter(f => selected.has(f.id))
      .map(f => ({ url: f.presignedUrl, storageKey: f.path, filename: fileNameOf(f) }));
    downloadMany(items);
  };

  if (isLoading) {
    return <div className="px-4 py-3 text-sub-sm text-text-tertiary">로딩 중...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 보낸사람·파일명 통합 검색 줄 (RN 검색 모드 패리티 — 드롭다운 + 칩 + 파일명 안내 행) */}
      <div className="sticky top-0 z-10">
        <SenderSearchBar
          roomId={roomId}
          channelType={channelType}
          contentType={['FILE']}
          selectedSender={selectedSender}
          onChange={onSenderChange}
          placeholder="보낸사람 · 파일명 검색"
          keyword={query}
          onKeywordChange={setQuery}
          showFilenameOption
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
          disabled={filtered.length === 0}
          className={cn(
            'flex h-8 items-center justify-center gap-0.5 rounded-md border bg-white px-2 text-sub font-medium',
            filtered.length === 0
              ? 'border-gray-200 text-gray-400 opacity-50'
              : selectMode
                ? 'border-gray-200 text-text-primary'
                : 'border-primary text-primary',
          )}
        >
          {!selectMode && <IconCheck width={16} height={11} />}
          {selectMode ? (selected.size > 0 ? `${selected.size} 선택해제` : '선택해제') : '선택'}
        </button>
      </div>

      {/* 목록만 내부 스크롤 — 하단 다운로드 바가 콘텐츠 길이와 무관하게 패널 바닥에 붙는다 */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-1">
        {filtered.length === 0 && (
          /* RN SidePanelSelectItemList 패리티 — EmptyContainer + 검색 중 '찾는 ' 접두 */
          <EmptyState
            variant={isFilterMode ? 'search' : 'sad'}
            message={`${isFilterMode ? '찾는 ' : ''}파일이 없어요.`}
            className="py-10"
          />
        )}
        {/* RN SidePanelSelectItemFile 패리티 — 날짜 헤더 + 카드형 행 */}
        {groupByDate(filtered).map(group => (
          <div key={group.date} className="mb-2.5">
            <p className="mb-2.5 px-4 text-sub text-text-primary">{group.date}</p>
            <div className="flex flex-col gap-2.5 px-2.5">
              {group.items.map(file => {
                const fileName = fileNameOf(file);
                const isDownloading = downloadingId === file.id;
                const isChecked = selected.has(file.id);
                const isBlocked = !!file.senderId && isBlockedUser(String(file.senderId));
                return (
                  <div
                    key={file.id}
                    className="flex items-start gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white px-2.5 py-4"
                    onClick={selectMode ? () => toggle(file.id) : undefined}
                    role={selectMode ? 'button' : undefined}
                  >
                    {/* 56px 미리보기 — 썸네일 없으면 확장자 아이콘. 차단 발신자는 미리보기만 가림
                        (RN Figma 3170:59084 — 파일명/용량/다운로드는 그대로) */}
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gray-50">
                      {file.thumbnailPresignedUrl || file.thumbnailPath ? (
                        <PresignedImage
                          storageKey={file.thumbnailPath}
                          fallbackUrl={file.thumbnailPresignedUrl}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileTypeIcon fileName={fileName} size={42} />
                      )}
                      {isBlocked && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
                          <IconBlock width={18} height={18} className="text-gray-500" />
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <HighlightedFileName name={fileName} keyword={q} />
                      <div className="flex items-center gap-1.5 text-sub text-text-primary">
                        <span>용량</span>
                        <span>{formatBytes(file.fileSize, { fallback: '-' })}</span>
                      </div>
                    </div>
                    {selectMode ? (
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md border',
                          isChecked ? 'border-primary bg-primary' : 'border-gray-300 bg-white',
                        )}
                      >
                        {isChecked && <IconCheck width={16} height={11} className="text-on-primary" />}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => download(file.id, file.presignedUrl, fileName, file.path)}
                        disabled={isDownloading}
                        className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-50"
                        aria-label="다운로드"
                      >
                        {isDownloading ? <Spinner /> : <IconDownload size={16} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-2 text-sub-sm text-primary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-50"
          >
            {isFetchingNextPage ? '로딩 중...' : '더 보기'}
          </button>
        )}
      </div>

      {/* 선택 모드 하단 일괄 다운로드 바 — 0개면 회색 비활성 (RN SidePanelSelectItemDownload 패리티) */}
      {selectMode && (
        <div className="shrink-0 border-t border-divider bg-background p-3">
          <button
            type="button"
            onClick={handleBulkDownload}
            disabled={bulkDownloading || selected.size === 0}
            className={cn(
              // rounded-xl — 사이드패널 '채팅방 나가기' 솔리드 버튼과 동일 스케일 (RN rounded-2xl은 h-56 모바일 기준)
              'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-body font-medium text-white',
              selected.size === 0 ? 'bg-gray-400' : 'bg-primary',
            )}
          >
            {bulkDownloading ? <Spinner /> : <IconDownload size={16} />}
            {bulkDownloading ? '다운로드 중...' : '파일 다운로드'}
          </button>
        </div>
      )}
    </div>
  );
}

/** 파일명 2줄 + 검색어 하이라이트 (RN HighlightedFileName 패리티 — brand-sub1-300 = blue-300) */
function HighlightedFileName({ name, keyword }: { name: string; keyword: string }) {
  const base = 'line-clamp-2 break-all text-body text-text-primary';
  const key = keyword.trim().toLowerCase();
  if (!key) return <div className={base}>{name}</div>;

  const lower = name.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  while (cursor < name.length) {
    const idx = lower.indexOf(key, cursor);
    if (idx === -1) {
      parts.push({ text: name.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) parts.push({ text: name.slice(cursor, idx), match: false });
    parts.push({ text: name.slice(idx, idx + key.length), match: true });
    cursor = idx + key.length;
  }
  return (
    <div className={base}>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-blue-300 text-inherit">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </div>
  );
}

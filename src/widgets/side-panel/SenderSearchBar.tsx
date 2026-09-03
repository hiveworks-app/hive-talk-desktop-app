'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFileSendersInfiniteQuery } from '@/features/chat-room-side-panel/queries';
import type { FileSenderContentType, FileSenderItem } from '@/features/chat-room-side-panel/type';
import { cn } from '@/shared/lib/cn';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { Spinner } from '@/shared/ui/Spinner';
import { useAuthStore } from '@/store/auth/authStore';
import { isBlockedUser } from '@/store/blockedMembersStore';
import IconBlock from '@assets/icons/block.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import { IconCheck, IconCircleClose, IconFindFile, IconSearchDefault } from '@assets/icons';
import type { WebSocketChannelTypes } from '@/shared/types/websocket';

const KEYWORD_DEBOUNCE_MS = 250; // RN SidePanelSenderSearchDropdown과 동일

interface SenderSearchBarProps {
  roomId: string;
  channelType: WebSocketChannelTypes;
  contentType: FileSenderContentType[];
  selectedSender: FileSenderItem | null;
  onChange: (sender: FileSenderItem | null) => void;
  /** 기본 '보낸사람 검색' — 파일 탭은 '보낸사람 · 파일명 검색' (RN placeholder 패리티) */
  placeholder?: string;
  /** 키워드를 부모와 공유(파일 탭 — 파일명 서버 필터로도 사용). 미전달 시 내부 상태 */
  keyword?: string;
  onKeywordChange?: (value: string) => void;
  /** 드롭다운 첫 행 '파일명으로 입력 가능' 안내 노출 (RN FilenameInfoRow — 파일 탭 전용) */
  showFilenameOption?: boolean;
}

/**
 * 보낸사람 검색 줄 (RN ChatRoomSidePanelSelectItemScreen 검색 모드 + SidePanelSenderSearchDropdown 패리티).
 * 입력 → 발신자 드롭다운(서버 /senders 검색) → 선택 시 칩 1개. 단일 선택 (RN 동일).
 * - 칩이 있는 상태에서 타이핑 시작 → 칩 자동 제거 (새 검색 의도)
 * - 키워드 빈 상태에서 backspace → 칩 제거
 * - ✕ → 키워드 + 칩 모두 클리어
 */
export function SenderSearchBar({
  roomId,
  channelType,
  contentType,
  selectedSender,
  onChange,
  placeholder = '보낸사람 검색',
  keyword: keywordProp,
  onKeywordChange,
  showFilenameOption = false,
}: SenderSearchBarProps) {
  const [innerKeyword, setInnerKeyword] = useState('');
  const keyword = keywordProp ?? innerKeyword;
  const setKeyword = (value: string) => {
    onKeywordChange?.(value);
    if (keywordProp === undefined) setInnerKeyword(value);
  };
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const myUserId = useAuthStore(s => (s.user?.id != null ? String(s.user.id) : ''));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keyword]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    ...getFileSendersInfiniteQuery({ roomId, channelType, contentType, keyword: debouncedKeyword }),
    // 포커스된 뒤에만 조회 — 포커스 시점 조회가 RN의 진입 prefetch 역할을 겸한다
    enabled: !!roomId && isFocused,
  });

  // 본인 우선 정렬 (RN 피그마 — '나' 칩 항상 최상단)
  const senders = (() => {
    const flat = data?.pages.flatMap(p => p.items) ?? [];
    return [...flat].sort((a, b) => {
      const aIsMe = String(a.userId) === myUserId;
      const bIsMe = String(b.userId) === myUserId;
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return 0;
    });
  })();

  const isChipBlocked = !!selectedSender && isBlockedUser(String(selectedSender.userId));
  const showClear = keyword.length > 0 || !!selectedSender;
  const showDropdown = isFocused && (isLoading || senders.length > 0 || showFilenameOption);

  const handleSelect = (sender: FileSenderItem) => {
    onChange(sender);
    setKeyword('');
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      {/* py-2.5 — 검색줄 높이 40px 통일 (2026-09-03 전수 감사: py-2는 ~36px로 검색바 표준 이탈) */}
      <div className="flex items-center gap-2.5 border-b border-divider bg-background px-4 py-2.5">
        <IconSearchDefault width={20} height={20} className="shrink-0 text-text-primary" />
        {selectedSender && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex max-w-[45%] shrink-0 items-center gap-1 rounded bg-blue-100 p-1"
            title="보낸사람 필터 해제"
          >
            <span className={cn('truncate text-sub', isChipBlocked ? 'text-gray-600' : 'text-gray-900')}>
              {selectedSender.name}
            </span>
            {selectedSender.isExternal && (
              <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
            )}
            {isChipBlocked && <IconBlock width={16} height={16} className="shrink-0 text-gray-500" />}
          </button>
        )}
        <input
          ref={inputRef}
          value={keyword}
          onChange={e => {
            setKeyword(e.target.value);
            // 칩이 있는데 타이핑 시작 → 칩 제거 (RN — 새 검색 의도로 해석)
            if (e.target.value.length > 0 && selectedSender) onChange(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && keyword === '' && selectedSender) onChange(null);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sub text-text-primary outline-none placeholder:text-text-tertiary"
        />
        {showClear && (
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              onChange(null);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-text-tertiary transition-opacity hover:opacity-70 active:opacity-60"
            aria-label="검색 지우기"
          >
            <IconCircleClose width={20} height={20} />
          </button>
        )}
      </div>

      {/* 발신자 드롭다운 — 입력 아래 플로팅 (RN absolute top-2 rounded-xl 그림자).
          onMouseDown preventDefault로 input blur보다 클릭이 먼저 처리되게 한다 */}
      {showDropdown && (
        <div
          onMouseDown={e => e.preventDefault()}
          className="absolute inset-x-4 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl bg-white shadow-[0px_2px_11px_rgba(0,0,0,0.12)]"
        >
          {/* 파일 탭 안내 행 — 클릭 불가 정보성 (RN FilenameInfoRow: 키워드 echo 또는 안내 문구) */}
          {showFilenameOption && (
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-700">
                <IconFindFile width={24} height={24} className="text-white" />
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-gray-700">
                {keyword.trim() || '파일명으로 입력 가능'}
              </span>
            </div>
          )}
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
                  <div className="h-10 w-10 rounded-full bg-gray-100" />
                  <div className="h-5 flex-1 rounded bg-gray-100" />
                </div>
              ))
            : senders.map(sender => {
                const isMe = String(sender.userId) === myUserId;
                const isSelected = String(sender.userId) === String(selectedSender?.userId ?? '');
                const isBlocked = isBlockedUser(String(sender.userId));
                return (
                  <button
                    key={sender.userId}
                    type="button"
                    onClick={() => handleSelect(sender)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-blue-100',
                      isSelected && 'bg-blue-100',
                    )}
                  >
                    <ProfileCircle name={sender.name} storageKey={sender.thumbnailProfileUrl} className="h-10 w-10" />
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      {isMe && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFED66] text-[11px] font-semibold text-gray-900">
                          나
                        </span>
                      )}
                      <span className={cn('truncate text-body', isBlocked ? 'text-gray-600' : 'text-gray-900')}>
                        {sender.name}
                      </span>
                      {sender.isExternal && (
                        <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
                      )}
                      {isBlocked && <IconBlock width={16} height={16} className="shrink-0 text-gray-500" />}
                    </span>
                    {isSelected && <IconCheck width={14} height={10} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
          {hasNextPage && !isLoading && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-2 text-center text-sub-sm text-primary transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              {isFetchingNextPage ? <Spinner className="mx-auto block h-4 w-4" /> : '더 보기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

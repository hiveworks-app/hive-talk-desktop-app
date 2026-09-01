'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTitleBarColor } from '@/shared/hooks/useTitleBarColor';
import { cn as cnHeader } from '@/shared/lib/cn';
import { formatDotDate } from '@/shared/utils/formatTimeUtils';
import { isBlockedUser } from '@/store/blockedMembersStore';
import IconBlock from '@assets/icons/block.svg';
import { IconDownload, IconOptionDelete } from '@assets/icons';
import { useMediaViewerControls } from './useMediaViewerControls';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  storageKey?: string;
  author?: string;
  /** 전송 시각 (ISO) — 헤더 2줄째 날짜 표기 (RN ChatRoomMediaScreen 패리티) */
  createdAt?: string;
  /** 발신자 userId — 차단 표기 판정용 */
  senderId?: string;
  /** 비디오 로드 전 보여줄 정지 이미지(썸네일). presigned 만료 허용. */
  poster?: string;
  /** 같은 메시지(묶음)에 속한 항목끼리 공유하는 식별자 — 묶음 전체 저장 판정용 (RN 묶음 사진 패리티) */
  bundleId?: string;
}

interface MediaViewerProps {
  visible: boolean;
  items: MediaViewerItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** 헤더 우측(다운로드 왼쪽) 텍스트 액션 — RN ProfileImageViewerScreen '프로필 수정' pill 대응 */
  headerAction?: { label: string; onClick: () => void };
  /** 다운로드 버튼 표시 여부 (기본 true) — 타인 프로필 이미지는 저장 불가 (RN canManageProfile 패리티) */
  showDownload?: boolean;
  /** 삭제 액션 — 내 프로필 사진 뷰어에서만 (RN ProfileImageViewerScreen [삭제] 대응) */
  onDelete?: () => void;
}

/** Outer shell: dimmed 관리 + visible 가드 */
export function MediaViewer(props: MediaViewerProps) {
  if (!props.visible || !props.items[props.currentIndex]) return null;
  return <MediaViewerContent {...props} />;
}

function MediaViewerContent({ items, currentIndex, onIndexChange, onClose, headerAction, showDownload = true, onDelete }: MediaViewerProps) {
  // 검은 풀스크린 위에서 Windows 타이틀바 버튼 영역만 흰 네모로 뜨지 않게 동기화 (bg-black/95 근사)
  useTitleBarColor('#111111');
  const {
    videoRef, contentRef,
    view, isLoading, setIsLoading, hasError, isFetchingUrl,
    item, displayUrl,
    hasPrev, hasNext, isZoomed,
    goPrev, goNext,
    handleDoubleClick, handleMouseDown, handleDownload, handleMediaError,
    bundleItems, isBundleDownloading, handleDownloadBundle,
  } = useMediaViewerControls(items, currentIndex, onIndexChange, onClose);

  if (!item) return null;

  // electron-no-drag: 아래 깔린 화면의 창 드래그 영역이 뷰어 상단 버튼 클릭을 삼키지 않도록
  return (
    <div className="electron-no-drag animate-fade-in-fast fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* macOS 신호등(좌상단 창 버튼)·Windows 타이틀바 영역 확보용 드래그 바 (CreateRoomDialog와 동일) */}
      <div className="electron-drag h-8 w-full shrink-0" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-opacity hover:opacity-70 active:opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          {item.author && (
            <span
              className={cnHeader(
                'flex items-center gap-1 text-sub font-medium',
                item.senderId && isBlockedUser(item.senderId) ? 'text-white/50' : 'text-white/90',
              )}
            >
              {item.senderId && isBlockedUser(item.senderId) && (
                <IconBlock width={14} height={14} className="shrink-0" />
              )}
              {item.author}
            </span>
          )}
          {/* 전송 날짜 + 인덱스 (RN 헤더 2줄 구성 패리티) */}
          <span className="text-caption text-white/50">
            {item.createdAt ? formatDotDate(item.createdAt) : ''}
            {item.createdAt && items.length > 1 ? ' · ' : ''}
            {items.length > 1 ? `${currentIndex + 1} / ${items.length}` : ''}
          </span>
        </div>
        <div className="z-10 flex items-center gap-2">
          {headerAction && (
            /* RN ProfileImageViewerScreen [프로필 수정] 동일 스타일 — h-38 rounded-lg bg-white/70 px-2.5 */
            <button
              onClick={headerAction.onClick}
              className="flex h-[38px] items-center justify-center rounded-lg bg-white/70 px-2.5 text-body font-medium text-gray-900 transition-opacity hover:opacity-80 active:opacity-60"
            >
              {headerAction.label}
            </button>
          )}
          {/* 내 프로필 사진 뷰어(onDelete 존재)는 다운로드가 하단 바로 내려간다 (RN 패리티) */}
          {showDownload && !onDelete && (
            bundleItems.length > 1 ? (
              /* 묶음 사진 — 다운로드 버튼이 '전체 저장/이 사진만' 메뉴가 된다 (RN 액션시트의 데스크톱 번역) */
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    disabled={isBundleDownloading}
                    className="flex h-9 items-center justify-center rounded-full bg-white/10 px-3.5 text-sub font-medium text-white/90 transition-colors hover:bg-white/20 active:bg-white/25 disabled:opacity-50"
                  >
                    {isBundleDownloading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
                    ) : (
                      '다운로드'
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="motion-menu z-[60] w-52 overflow-hidden rounded-xl bg-white py-1 shadow-[0px_2px_15px_rgba(0,0,0,0.15)] focus:outline-none"
                  >
                    <DropdownMenu.Item
                      onSelect={() => void handleDownloadBundle()}
                      className="flex h-[46px] cursor-pointer items-center border-b border-gray-200 p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
                    >
                      묶음 사진 전체 저장 ({bundleItems.length}장)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handleDownload}
                      className="flex h-[46px] cursor-pointer items-center p-3 text-body text-text-primary outline-none data-[highlighted]:bg-gray-200"
                    >
                      이 사진만 저장
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <button
                onClick={handleDownload}
                className="flex h-9 items-center justify-center rounded-full bg-white/10 px-3.5 text-sub font-medium text-white/90 transition-colors hover:bg-white/20 active:bg-white/25"
              >
                다운로드
              </button>
            )
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {hasPrev && (
          <button onClick={goPrev} className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center p-8">
          {hasError ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-sub">이미지를 불러올 수 없습니다</span>
            </div>
          ) : isFetchingUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            </div>
          ) : item.type === 'image' ? (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
              )}
              <img
                key={displayUrl}
                src={displayUrl}
                alt=""
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `scale(${view.scale}) translate(${view.tx}px, ${view.ty}px)`,
                  cursor: isZoomed ? 'grab' : 'default',
                  opacity: isLoading ? 0 : 1,
                  transition: 'opacity 0.2s',
                }}
                draggable={false}
                onLoad={() => setIsLoading(false)}
                onError={handleMediaError}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
              />
            </>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
              )}
              <video
                key={displayUrl}
                ref={videoRef}
                src={displayUrl}
                poster={item.poster}
                controls
                autoPlay
                className="max-h-full max-w-full"
                onClick={e => e.stopPropagation()}
                onLoadedData={() => setIsLoading(false)}
                onError={handleMediaError}
              />
            </>
          )}
        </div>

        {hasNext && (
          <button onClick={goNext} className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
      </div>

      {/* 하단 바: 다운로드(좌)·삭제(우) — RN ProfileImageViewerScreen 하단 바 패리티.
          내 프로필 사진 뷰어에서만 노출, 상단 헤더에는 [프로필 수정]만 남는다 */}
      {onDelete && (
        <div className="z-10 flex h-14 shrink-0 items-center justify-between bg-black/90 px-2.5">
          {showDownload ? (
            <button
              onClick={handleDownload}
              aria-label="다운로드"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconDownload width={24} height={24} />
            </button>
          ) : (
            <span className="h-11 w-11" />
          )}
          <button
            onClick={onDelete}
            aria-label="프로필 사진 삭제"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70 active:opacity-60"
          >
            <IconOptionDelete width={24} height={24} />
          </button>
        </div>
      )}
    </div>
  );
}

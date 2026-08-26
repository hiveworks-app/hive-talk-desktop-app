'use client';

import { useCallback, useMemo, useState } from 'react';
import { IconArrowDown, IconBlock, IconBubbleMe, IconBubbleYou, IconCaution, IconDownload } from '@assets/icons';
import { getBlockedFoldText } from '@/features/block/blockedMessage';
import { composeContextMenuTags } from '@/features/tag/quickTags';
import { BUBBLE_TEXT_TRUNCATE_CHARS, IS_DELETE_MESSAGE_COMMENTS, MESSAGE_DELETE_WINDOW_MS } from '@/shared/config/constants';
import { useFileDownload } from '@/features/chat-room-side-panel/useFileDownload';
import { resolveFileName } from './ChatFileCard';
import { cn } from '@/shared/lib/cn';
import type { MediaViewerItem } from '@/shared/ui/MediaViewer';
import { LinkPreviewCard } from '@/shared/ui/LinkPreviewCard';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { extractFirstUrl } from '@/shared/utils/linkPreview';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useRecentTagUsageStore } from '@/store/tag/recentTagUsageStore';
import { BubbleTagRow } from './BubbleTagRow';
import { DateSeparator } from './DateSeparator';
import { FailedMessageActions } from './FailedMessageActions';
import { MessageContent } from './MessageContent';
import { MessageContextMenu, type QuickTagItem } from './MessageContextMenu';
import { NoticePill } from './NoticePill';

interface MessageBubbleProps {
  message: ChatMessageUI;
  prevMessage?: ChatMessageUI;
  nextMessage?: ChatMessageUI;
  index: number;
  isFocused: boolean;
  onOpenMedia: (items: MediaViewerItem[], startIndex: number) => void;
  onSetNotice?: (message: ChatMessageUI) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditTag?: (message: ChatMessageUI) => void;
  onRetryMessage?: (messageId: string) => void;
  onRemoveFailedMessage?: (messageId: string) => void;
  onReportMessage?: (messageId: string) => void;
  /** 장문 '전체보기' 클릭 → 전체 메시지 다이얼로그 (RN 패리티) */
  onExpandFullText?: (message: ChatMessageUI) => void;
  /** 발신자 아바타 클릭 → 프로필 다이얼로그 (RN 패리티) */
  onOpenProfile?: (message: ChatMessageUI) => void;
  /** 태그 빠른선택 토글 — 이미 달린 태그면 해제, 아니면 부착 (RN handleQuickTagToggle 패리티) */
  onQuickTagToggle?: (message: ChatMessageUI, tagName: string) => void;
  /** 차단 발신자 메시지 — 접힘 처리 (정책 block.md) */
  isBlockedSender?: boolean;
  /** 차단 메시지 펼침 상태 (방 재진입 시 초기화 — 세션 로컬) */
  isBlockExpanded?: boolean;
  onToggleBlockExpand?: (messageId: string) => void;
}

export function MessageBubble({
  message, prevMessage, nextMessage, index, isFocused,
  onOpenMedia, onSetNotice, onDeleteMessage, onEditTag,
  onRetryMessage, onRemoveFailedMessage, onReportMessage, onQuickTagToggle, onOpenProfile, onExpandFullText,
  isBlockedSender = false, isBlockExpanded = false, onToggleBlockExpand,
}: MessageBubbleProps) {
  const isMe = message.sender === 'me';
  const isSystem = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED;
  const isDeleted = message.isDeleted;
  const isMediaType = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;
  // 이미지/미디어는 그리드 폭(240) 제한, 파일 카드(248px)는 텍스트와 동일한 288 폭 허용
  const isImageType = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE || message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA;
  // 파일 메시지: 다운로드 버튼을 메타 컬럼에 둔다 (보낸 메시지=좌측, 받은 메시지=우측 — flex-row-reverse 대칭 활용, Figma 1334-33805)
  const isFileMessage = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE;
  // 메시지에 실려온 presigned URL은 곧 만료된다 — 카드와 동일하게 클릭 시 키로 fresh 재발급 (RN 패리티)
  const firstFile = isFileMessage ? message.files?.[0] : undefined;
  const { download: downloadChatFile, downloadingId: downloadingFileId } = useFileDownload();
  const isTextMessage = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT && !isDeleted;
  const firstUrl = isTextMessage ? extractFirstUrl(message.text) : null;
  // 공지 등록 가능: 텍스트 + 단일이미지/미디어/파일 (전송완료된 것만, 묶음 사진 제외 — RN 패리티)
  const canSetNotice = !message.isLocal && !isDeleted && (
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT ||
    (message.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE && (message.files?.length ?? 0) === 1) ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA ||
    message.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE
  );
  const isFailed = message.isLocal && message.localStatus === 'failed';
  // 신고 접수(신고자 본인) 마스킹 — 안내 버블로 렌더, 메뉴/태그 제외 (RN 패리티)
  const isReportedMask = message.messageContentType === WS_MESSAGE_CONTENT_TYPE.REPORTED_MASK;
  // 차단 접힘 — 삭제/신고 마스킹이 우선하고, 내 메시지·시스템 메시지는 대상 아님 (RN 패리티)
  const isBlocked = isBlockedSender && !isMe && !isSystem && !isDeleted;
  const isBlockedCollapsed = isBlocked && !isBlockExpanded;
  // DM 상대 회원탈퇴/소속해제 — 메뉴는 텍스트 복사만 허용 (RN 패리티)
  const otherUserIsRemoved = useChatRoomInfo(s => s.otherUserIsRemoved);
  // 전송 실패 메시지도 메뉴 허용(복사 목적 — RN 패리티). 서버 의존 액션(삭제/태그)은 아래에서 로컬 제외.
  const hasContextMenu =
    !isDeleted && !isSystem && !isBlockedCollapsed && !isReportedMask &&
    (!otherUserIsRemoved || isTextMessage);
  const hasTags = !isDeleted && !isBlockedCollapsed && (message.tags?.length ?? 0) > 0;

  const showDateSeparator = !prevMessage || message.createdAt.slice(0, 10) !== prevMessage.createdAt.slice(0, 10);
  // 직전이 시스템 메시지(초대/퇴장/제목변경/신고)면 그룹핑하지 않는다.
  // 시스템 메시지는 아바타가 없는 가운데 알림이라, 묶이면 다음 일반 메시지의 아바타·이름까지 사라져 "빈 프로필"처럼 보인다.
  const isPrevSystem = !!prevMessage && (
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE ||
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT ||
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE ||
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE ||
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE ||
    prevMessage.messageContentType === WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED
  );
  // 전송실패 로컬 메시지는 그룹핑 제외 (RN ChatMessageItem 패리티 — 실패 표시가 그룹에 묻히지 않게)
  const isPrevFailed = !!prevMessage?.isLocal && prevMessage.localStatus === 'failed';
  const isSameSender = !isPrevSystem && !isPrevFailed && !isFailed && prevMessage && prevMessage.sender === message.sender && prevMessage.name === message.name && prevMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16);
  // 다음이 전송실패 로컬·시스템 신고 안내면 그룹으로 묶지 않는다 — 시간 표시가 밀리지 않게 (RN 패리티)
  const isNextFailed = !!nextMessage?.isLocal && nextMessage.localStatus === 'failed';
  const isNextSameGroup = nextMessage && !isNextFailed && !isFailed && nextMessage.sender === message.sender && nextMessage.name === message.name && nextMessage.createdAt.slice(0, 16) === message.createdAt.slice(0, 16) && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_INVITE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE && nextMessage.messageContentType !== WS_MESSAGE_CONTENT_TYPE.SYSTEM_REPORTED;
  const showTime = !isNextSameGroup;


  // 전송 후 24시간이 지난 내 메시지는 삭제 불가(정책 chat-room.md, 서버 코드 DM006) → 메뉴에서 제외.
  // 렌더 순수성 유지를 위해 현재 시각은 마운트 시 1회 스냅샷 — 경계를 넘는 드문 stale은 서버가 최종 방어 (RN 패리티)
  const [mountedNowMs] = useState(() => Date.now());
  const isWithinDeleteWindow = useMemo(() => {
    const createdMs = new Date(message.createdAt).getTime();
    // createdAt 파싱 실패 시 메뉴를 유지해 서버가 최종 판단하도록 위임 (fail-open)
    if (Number.isNaN(createdMs)) return true;
    return mountedNowMs - createdMs <= MESSAGE_DELETE_WINDOW_MS;
  }, [mountedNowMs, message.createdAt]);

  // 복사 피드백 UI 없음 — RN 7/15 '복사 시 토스트 노출 제거' 패리티
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text);
  }, [message.text]);

  // 태그 빠른선택 슬롯 (5칸) — 삭제/차단/탈퇴/로컬 메시지는 미표시 (RN 패리티)
  const recentTagNames = useRecentTagUsageStore(s => s.names);
  const showQuickTags = hasContextMenu && !isBlocked && !isReportedMask && !otherUserIsRemoved && !message.isLocal;
  const quickTags = useMemo<QuickTagItem[] | undefined>(() => {
    if (!showQuickTags || !onQuickTagToggle) return undefined;
    const messageTagTitles = (message.tags ?? []).map(t => t.title);
    return composeContextMenuTags(messageTagTitles, recentTagNames).map(name => ({
      name,
      selected: messageTagTitles.includes(name),
      onToggle: () => onQuickTagToggle(message, name),
    }));
  }, [showQuickTags, onQuickTagToggle, message, recentTagNames]);

  // 채팅 말풍선: 내=하늘색(#D0E8FF), 상대=#EEEFF2, 흰 배경 위 배치 (RN chatRoomTheme 확정값, 7/23 시안)
  // 글씨는 테마 무관 항상 진한색(gray-900).
  // 본문 타이포는 RN text-body(16px) 정본
  const bubbleStyle = cn('relative min-w-0 max-w-[min(80cqw,640px)] rounded-xl px-2.5 py-2 text-body', isMe ? 'bg-bubble-me text-gray-900' : 'bg-bubble-other text-gray-900');
  // 말풍선 꼬리 — 같은 발신자·같은 분 그룹의 첫 메시지에만 노출 (RN 패리티)
  const bubbleTail = !isSameSender && (
    isMe ? (
      <IconBubbleMe width={14} height={13} className="pointer-events-none absolute -right-1 top-0.5 text-bubble-me" />
    ) : (
      <IconBubbleYou width={14} height={13} className="pointer-events-none absolute -left-1 top-0.5 text-bubble-other" />
    )
  );

  if (isSystem) {
    // 발신자 이름 소급 표시 — 파싱 시점에 bake된 문구 대신 렌더 시점 message.name으로 재조립.
    // 프로필 이름 변경이 과거 시스템 메시지에도 반영된다 (RN 7/15 패리티). 초대(명단 포함)·신고 확정(서버 문구)은 bake 유지.
    const systemText = (() => {
      switch (message.messageContentType) {
        case WS_MESSAGE_CONTENT_TYPE.SUBMIT_EXIT:
          return `${message.name}님이 채팅방을 나갔어요.`;
        case WS_MESSAGE_CONTENT_TYPE.SUBMIT_ROOM_TITLE_UPDATE:
        case WS_MESSAGE_CONTENT_TYPE.SUBMIT_CHANGE_TITLE:
          return `${message.name}님이 방 제목을 변경했어요.`;
        case WS_MESSAGE_CONTENT_TYPE.SUBMIT_NOTICE:
          return `${message.name}님이 공지를 올렸어요.`;
        default:
          return message.text;
      }
    })();
    return (
      <>
        {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
        <NoticePill data-msg-index={index} className="my-2">{systemText}</NoticePill>
      </>
    );
  }

  const bubbleContent = (
    <div
      data-msg-index={index}
      // RN 패리티 — 검색 포커스는 텍스트 하이라이트만 (행 배경 강조 없음); data 속성은 스크롤 타겟팅용
      data-search-focused={isFocused || undefined}
      className={cn('@container flex gap-2 transition-colors', isMe ? 'flex-row-reverse' : 'flex-row', isSameSender ? 'mt-1.5' : 'mt-3.5')}
    >
      {!isMe && !isSameSender && (
        <button
          type="button"
          onClick={onOpenProfile ? () => onOpenProfile(message) : undefined}
          disabled={!onOpenProfile}
          aria-label={`${message.name} 프로필 보기`}
          className="h-fit shrink-0 rounded-full enabled:cursor-pointer"
        >
          {/* 상대 아바타 36px (데스크톱 밀도 — RN 40px에서 축소) */}
          <ProfileCircle name={message.name} size="sm" storageKey={message.thumbnailProfileUrl || message.profileImageUrl} />
        </button>
      )}
      {!isMe && isSameSender && <div className="w-9 shrink-0" />}

      <div
        className={cn(
          'flex min-w-0 flex-col',
          isMe ? 'items-end' : 'items-start',
          // 폭 제한은 말풍선 자체(bubbleStyle)에 적용 — 시간 컬럼 유무와 무관하게 동일 지점 줄바꿈.
          // 이미지는 그리드+시간 공간 확보용 고정폭 유지
          isImageType ? 'max-w-[304px]' : 'max-w-full',
        )}
      >
        {/* RN 패리티 — 이름 regular, 차단 아이콘은 이름 뒤 */}
        {!isMe && !isSameSender && (
          <span className={cn('mb-1 flex items-center gap-1 text-sub-sm', isBlocked ? 'text-gray-600' : 'text-gray-900')}>
            {message.name}
            {isBlocked && <IconBlock width={16} height={16} className="text-gray-500" />}
          </span>
        )}
        <div className={cn('flex items-end gap-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
          {isDeleted || isReportedMask ? (
            <div className={cn(bubbleStyle, 'flex items-center gap-1 text-text-secondary')}>
              {bubbleTail}
              <IconCaution width={16} height={16} className="shrink-0 text-gray-600" />
              {isDeleted ? IS_DELETE_MESSAGE_COMMENTS : message.text}
            </div>
          ) : isBlockedCollapsed ? (
            /* 차단 메시지 접힘 — 버블 전체가 펼침 토글 (RN BlockedTextBubble 패리티) */
            <button
              type="button"
              onClick={() => {
                // 긴 텍스트는 인라인 펼침 대신 전체보기로 — 접힘 상태 유지 (RN getBlockedExpandAction 패리티)
                if (isTextMessage && (message.text?.length ?? 0) >= BUBBLE_TEXT_TRUNCATE_CHARS && onExpandFullText) {
                  onExpandFullText(message);
                  return;
                }
                onToggleBlockExpand?.(message.id);
              }}
              className={cn(bubbleStyle, 'flex flex-col items-start text-left text-text-secondary transition-colors hover:bg-bubble-other-pressed')}
            >
              {bubbleTail}
              <span className="flex items-center gap-1">
                <IconCaution width={16} height={16} className="shrink-0 text-gray-600" />
                {getBlockedFoldText(message.messageContentType)}
              </span>
              {/* RN BlockedToggleButton 패리티 — 접힘 버블 하단 [메시지 보기 ▾] 명시 */}
              <span className="mt-1 flex items-center gap-0.5 text-sub-sm font-medium text-primary">
                메시지 보기
                <IconArrowDown width={14} height={14} />
              </span>
            </button>
          ) : isMediaType ? (
            <MessageContent message={message} onOpenMedia={onOpenMedia} />
          ) : (
            <div className={bubbleStyle}>
              {bubbleTail}
              <MessageContent message={message} onOpenMedia={onOpenMedia} onExpandFullText={onExpandFullText} />
            </div>
          )}
          {/* RN 패리티 — 삭제된 메시지도 시간·읽음수 메타 컬럼 유지 */}
          <div
              className={cn(
                'flex shrink-0 flex-col gap-0.5',
                isMe ? 'items-end' : 'items-start',
                // 파일: 메타 컬럼을 카드 높이만큼 늘려 다운로드는 상단, 시간은 하단에 붙인다 (Figma 1334-33805)
                firstFile && !isBlockedCollapsed && 'self-stretch justify-between',
              )}
            >
              {message.isLocal ? (
                isFailed ? (
                  <FailedMessageActions
                    onRetry={() => onRetryMessage?.(message.id)}
                    onDelete={() => onRemoveFailedMessage?.(message.id)}
                  />
                ) : isMediaType ? (
                  /* 업로드 중 미디어/파일 — 썸네일 위 딤 오버레이의 진행률+X(취소)가 이미 상태를 알린다.
                     여기에 스피너까지 그리면 한 메시지에 로딩 표시가 둘이 된다 (RN MeBubble: 업로드 중 좌측 컬럼 null) */
                  null
                ) : (
                  /* 전송중 = 회전 스피너 — RN은 정적 재전송 모양 아이콘(IconMessageResend)이지만
                     실패 상태의 재전송 버튼과 혼동됨 → 데스크톱은 스피너 (사용자 결정 2026-08-21) */
                  <>
                    {/* 12px + 1.5px 선 — 링은 글리프보다 무겁게 읽혀 메타(11px) 스케일에 맞춰 축소 (사용자 조정 2026-08-21) */}
                    <span
                      role="status"
                      aria-label="전송 중"
                      className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-600"
                    />
                    {showTime && <span className="text-[11px] leading-[14px] text-gray-600">{message.time}</span>}
                  </>
                )
              ) : (
                <>
                  {firstFile && !isBlockedCollapsed && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadChatFile(
                          firstFile.path,
                          firstFile.presignedUrl,
                          resolveFileName(firstFile.path) || '파일',
                          firstFile.path,
                        )
                      }
                      disabled={downloadingFileId === firstFile.path}
                      aria-label="파일 다운로드"
                      className="flex size-8 items-center justify-center rounded-[10px] bg-black/30 transition-colors hover:bg-black/45 disabled:opacity-60"
                    >
                      <IconDownload width={18} height={18} className="text-white" />
                    </button>
                  )}
                  <div className={cn('flex flex-col gap-0', isMe ? 'items-end' : 'items-start')}>
                    {/* 차단 메시지는 접힘/펼침 무관 안읽음 배지 제외 (RN 패리티) */}
                    {!isBlocked && message.notReadCount > 0 && <span className="text-[11px] leading-[14px] font-semibold text-yellow">{message.notReadCount}</span>}
                    {showTime && <span className="text-[11px] leading-[14px] text-gray-600">{message.time}</span>}
                  </div>
                </>
              )}
          </div>
        </div>
        {isBlocked && isBlockExpanded && (
          <button
            type="button"
            onClick={() => onToggleBlockExpand?.(message.id)}
            className="mt-1 text-[12px] font-medium text-primary hover:underline"
          >
            메시지 숨기기
          </button>
        )}
        {firstUrl && !isBlockedCollapsed && <LinkPreviewCard url={firstUrl} className="mt-1" />}
        {hasTags && (
          <BubbleTagRow
            tags={message.tags!}
            // 차단 발신자·DM 상대 탈퇴/소속해제 시 태그는 표시만 — 편집 진입 차단 (RN 패리티)
            onClick={onEditTag && !isBlocked && !otherUserIsRemoved ? () => onEditTag(message) : undefined}
            className="mt-1"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {showDateSeparator && <DateSeparator dateStr={message.createdAt} />}
      <MessageContextMenu
        enabled={hasContextMenu}
        isTextMessage={isTextMessage}
        // 차단 펼침=복사·신고만 / DM 상대 제거=복사만 (RN 패리티)
        canSetNotice={canSetNotice && !isBlocked && !otherUserIsRemoved}
        isMe={isMe}
        onCopy={isTextMessage ? handleCopy : undefined}
        onSetNotice={onSetNotice && !isBlocked && !otherUserIsRemoved ? () => onSetNotice(message) : undefined}
        onDelete={onDeleteMessage && isWithinDeleteWindow && !otherUserIsRemoved && !message.isLocal ? () => onDeleteMessage(message.id) : undefined}
        onReport={!isMe && onReportMessage && !otherUserIsRemoved ? () => onReportMessage(message.id) : undefined}
        quickTags={quickTags}
        onMoreTags={!isBlocked && !otherUserIsRemoved && !message.isLocal && onEditTag ? () => onEditTag(message) : undefined}
      >
        {bubbleContent}
      </MessageContextMenu>
    </>
  );
}
